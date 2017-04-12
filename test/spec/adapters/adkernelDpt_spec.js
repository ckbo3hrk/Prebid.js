import {expect, assert} from 'chai';
import Adapter from 'src/adapters/adkernelDpt';
import * as ajax from 'src/ajax';
import * as utils from 'src/utils';
import bidmanager from 'src/bidmanager';
import CONSTANTS from 'src/constants.json';

describe('AdkernelDpt adapter', () => {

  const bid1_pub1 = {
    bidder: 'adkernelDpt',
    bidId: 'Bid_01',
    params: {pubId: 1, host: 'dsp.adkernel.com'},
    placementCode: 'ad-unit-1',
    sizes: [[300, 250]]
  }, bid2_pub2 = {
    bidder: 'adkernelDpt',
    bidId: 'Bid_02',
    params: {pubId: 2, host: 'dsp.adkernel.com'},
    placementCode: 'ad-unit-2',
    sizes: [[728, 90]]
  }, bid3_host2 = {
    bidder: 'adkernelDpt',
    bidId: 'Bid_02',
    params: {pubId: 1, host: 'dsp-private.adkernel.com'},
    placementCode: 'ad-unit-2',
    sizes: [[728, 90]]
  }, bid_without_pubId = {
    bidder: 'adkernelDpt',
    bidId: 'Bid_W',
    params: {host: 'dsp-private.adkernel.com'},
    placementCode: 'ad-unit-1',
    sizes: [[728, 90]]
  }, bid_without_host = {
    bidder: 'adkernelDpt',
    bidId: 'Bid_W',
    params: {pubId: 1},
    placementCode: 'ad-unit-1',
    sizes: [[728, 90]]
  };

  const bidResponse1 = {
    'id': 'ad-unit-1', 'bid' : 3.01, 'tag' : '<!-- admarkup goes here -->'
  }, bidResponse2 = {
    'id': 'ad-unit-2', 'bid' : 1.31, 'tag' : '<!-- admarkup goes here -->'
  };

  let adapter,
    sandbox,
    ajaxStub;

  beforeEach(() => {
    adapter = Adapter.createNew();
    sandbox = sinon.sandbox.create();
    ajaxStub = sandbox.stub(ajax, 'ajax');
  });

  afterEach(() => {
    sandbox.verifyAndRestore();
  });

  function doRequest(bids) {
    adapter.callBids({
      bidderCode: 'adkernelDpt',
      bids: bids
    });
  }

  function doRequestWithResponse(bids, responses) {
    assert(bids.length === responses.length, 'number of requests and responses should be equal');
    utils._each(responses, (response, index) => {
      let resp = '';
      if (typeof response === 'object') {
        resp = JSON.stringify({ tags : [ response ]});
      }
      ajaxStub.onCall(index).callsArgWith(1, resp);
    });
    doRequest(bids);
  }

  describe('input parameters validation', ()=> {
    beforeEach(() => {
      sandbox.stub(bidmanager, 'addBidResponse');
    });

    it('empty request shouldn\'t generate exception', () => {
      expect(adapter.callBids({
        bidderCode: 'adkernelDpt'
      })).to.be.an('undefined');
    });

    it('request without pubId shouldn\'t issue a request', () => {
      doRequest([bid_without_pubId]);
      expect(ajaxStub.called).to.be.equal(false);
      expect(bidmanager.addBidResponse.firstCall.args[1].getStatusCode()).to.equal(CONSTANTS.STATUS.NO_BID);
      expect(bidmanager.addBidResponse.firstCall.args[1].bidderCode).to.equal('adkernelDpt');
    });
  });

  describe('request building', () => {
    let requestTags;
    let params;
    let url;

    beforeEach(() => {
      sandbox.stub(utils, 'getTopWindowLocation', () => {
        return {
          protocol: 'https:',
          hostname: 'example.com',
          host: 'example.com',
          pathname: '/index.html',
          href : 'http://example.com/index.html'
        };
      });
      sandbox.stub(utils, 'getTopWindowReferrer', () => {
        return 'http://google.com/search?q=adkernel';
      });
      doRequestWithResponse([bid1_pub1], [bidResponse1]);
      params = ajaxStub.getCall(0).args[2];
      requestTags = JSON.parse(decodeURIComponent(params.tag));
    });

    it('should collect secure status', () => {
      expect(params).to.have.property('secure', 1);
    });

    it('should collect url information', () => {
      expect(params).to.have.property('page_url', encodeURIComponent('http://example.com/index.html'));
    });

    it('should collect referrer information', () => {
      expect(params).to.have.property('ref', encodeURIComponent('http://google.com/search?q=adkernel'));
    });

    it('should have tags object', () => {
      expect(params).to.have.property('tag');
    });

    it('should create proper tags block', () => {
      expect(requestTags).to.deep.equal([{id: 'ad-unit-1', size: '300x250'}]);
    });
  });

  describe('requests routing', () => {

    it('should issue a request for each network', () => {
      doRequestWithResponse([bid1_pub1, bid3_host2], [undefined, undefined]);
      expect(ajaxStub.calledTwice);
      expect(ajaxStub.firstCall.args[0]).to.include(bid1_pub1.params.host);
      expect(ajaxStub.secondCall.args[0]).to.include(bid3_host2.params.host);
    });

    it('should issue a request to default host if omitted', () => {
      doRequestWithResponse([bid_without_host], [undefined]);
      expect(ajaxStub.calledOnce);
      expect(ajaxStub.firstCall.args[0]).to.include('dsp.adkernel.com');
    });

    it('should issue a request for each pub id', () => {
      doRequestWithResponse([bid1_pub1, bid2_pub2], [bidResponse1 , bidResponse2]);
      expect(ajaxStub.calledTwice);
    });

    it('should route calls to proper pubId', () => {
      doRequestWithResponse([bid1_pub1, bid2_pub2], [bidResponse1 , bidResponse2]);
      expect(ajaxStub.firstCall.args[2].account).to.be.equal('1');
      expect(ajaxStub.secondCall.args[2].account).to.be.equal('2');
    });


  });

  describe('responses processing', () => {

    beforeEach(() => {
      sandbox.stub(bidmanager, 'addBidResponse');
    });

    it('should return fully-initialized bid-response', () => {
      doRequestWithResponse([bid1_pub1], [bidResponse1]);
      let bidResponse = bidmanager.addBidResponse.firstCall.args[1];
      expect(bidmanager.addBidResponse.firstCall.args[0]).to.be.equal('ad-unit-1');
      expect(bidResponse.getStatusCode()).to.be.equal(CONSTANTS.STATUS.GOOD);
      expect(bidResponse.bidderCode).to.be.equal('adkernelDpt');
      expect(bidResponse.cpm).to.be.equal(3.01);
      expect(bidResponse.ad).to.be.include('<!-- admarkup goes here -->');
      expect(bidResponse.width).to.be.equal(300);
      expect(bidResponse.height).to.be.equal(250);
    });

    it('should map responses to proper ad units', () => {
      doRequestWithResponse([bid1_pub1, bid2_pub2],[bidResponse1, bidResponse2]);
      expect(bidmanager.addBidResponse.firstCall.args[1].getStatusCode()).to.be.equal(CONSTANTS.STATUS.GOOD);
      expect(bidmanager.addBidResponse.firstCall.args[1].bidderCode).to.be.equal('adkernelDpt');
      expect(bidmanager.addBidResponse.firstCall.args[0]).to.be.equal('ad-unit-1');
      expect(bidmanager.addBidResponse.secondCall.args[1].getStatusCode()).to.be.equal(CONSTANTS.STATUS.GOOD);
      expect(bidmanager.addBidResponse.secondCall.args[1].bidderCode).to.be.equal('adkernelDpt');
      expect(bidmanager.addBidResponse.secondCall.args[0]).to.be.equal('ad-unit-2');
    });

    it('should process empty responses', () => {
      doRequestWithResponse([bid1_pub1, bid2_pub2],[bidResponse1, undefined]);
      expect(bidmanager.addBidResponse.firstCall.args[1].getStatusCode()).to.be.equal(CONSTANTS.STATUS.GOOD);
      expect(bidmanager.addBidResponse.firstCall.args[1].bidderCode).to.be.equal('adkernelDpt');
      expect(bidmanager.addBidResponse.firstCall.args[0]).to.be.equal('ad-unit-1');
      expect(bidmanager.addBidResponse.secondCall.args[1].getStatusCode()).to.be.equal(CONSTANTS.STATUS.NO_BID);
      expect(bidmanager.addBidResponse.secondCall.args[1].bidderCode).to.be.equal('adkernelDpt');
      expect(bidmanager.addBidResponse.secondCall.args[0]).to.be.equal('ad-unit-2');
    });
  });

  describe('adapter aliasing', () => {
    const ALIAS_NAME = 'adkernelAlias';

    it('should allow bidder code changing', () => {
      expect(adapter.getBidderCode()).to.be.equal('adkernelDpt');
      adapter.setBidderCode(ALIAS_NAME);
      expect(adapter.getBidderCode()).to.be.equal(ALIAS_NAME);
    });
  });
});
