import bidmanager from 'src/bidmanager';
import bidfactory from 'src/bidfactory';
import * as utils from 'src/utils';
import {ajax} from 'src/ajax';
import Adapter from 'src/adapters/adapter';

const DEFAULT_ADKERNEL_DSP_DOMAIN = 'dsp.adkernel.com';
/**
 * Adapter for requesting bids from AdKernel DSP
 * @class
 */
const AdKernelDptAdapter = function AdKernelDptAdapter() {
  const AJAX_REQ_PARAMS = {
    contentType: 'text/plain',
    withCredentials: true,
    method: 'GET'
  };
  const EMPTY_RESPONSE = {};

  let baseAdapter = Adapter.createNew('adkernelDpt');

  /**
   * Helper object to build multiple bid requests in case of multiple pubIds/ad-networks
   * @constructor
   */
  function Dispatcher() {
    const _dispatch = {};
    const originalBids = {};

    //translate adunit info into rtb impression dispatched by host/zone
    this.addImp = function (bidRequest) {
      let host = bidRequest.params.host || DEFAULT_ADKERNEL_DSP_DOMAIN;
      let pubId = bidRequest.params.pubId;
      let size = bidRequest.sizes[0];

      if (!(host in _dispatch)) {
        _dispatch[host] = {};
      }
      /* istanbul ignore else */
      if (!(pubId in _dispatch[host])) {
        _dispatch[host][pubId] = [];
      }

      let tagReq = {'id': bidRequest.placementCode, 'size': utils.parseGPTSingleSizeArray(size)};
      //save rtb impression for specified ad-network host and zone
      _dispatch[host][pubId].push(tagReq);
      originalBids[bidRequest.placementCode] = bidRequest;
    };

    /**
     *  Main function to get bid requests
     */
    this.dispatch = function (callback) {
      utils._each(_dispatch, (pubIds, host) => {
        utils.logMessage(`processing network ${host}`);
        utils._each(pubIds, (impressions, pubId) => {
          utils.logMessage(`processing publisher ${pubId}`);
          dispatchRequest(host, pubId, impressions, callback);
        });
      });
    };

    function dispatchRequest(host, pubId, tags, callback) {
      let url = buildEndpointUrl(host);
      let params = buildRequestParams(pubId, tags);
      ajax(url, (resp) => {
        resp = resp === '' ? EMPTY_RESPONSE : JSON.parse(resp);
        utils._each(tags, (tag) => {
          let bidFound = false;
          utils._each(resp.tags, (resTag) => {
            /* istanbul ignore else */
            if (!bidFound && tag.id === resTag.id) {
              bidFound = true;
              callback(tag.id, originalBids[tag.id], resTag);
            }
          });
          if (!bidFound) {
            callback(tag.id, originalBids[tag.id]);
          }
        });
      }, params, AJAX_REQ_PARAMS);
    }

    /**
     * Build ad-network specific endpoint url
     */
    function buildEndpointUrl(host) {
      return `${window.location.protocol}//${host}/tag`;
    }

    function buildRequestParams(pubId, imps) {
      let loc = utils.getTopWindowLocation();
      return {
        'account': encodeURIComponent(pubId),
        'page_url' : encodeURIComponent(loc.href),
        'ref' : encodeURIComponent(utils.getTopWindowReferrer()),
        'secure' : ~~('https:' === loc.protocol),
        'tag' : encodeURIComponent(JSON.stringify(imps)),
        'pb' : 1
      };
    }
  }

  /**
   *  Main module export function implementation
   */
  baseAdapter.callBids = function (params) {
    var bids = params.bids || [];
    processBids(bids);
  };

  /**
   *  Process all bids grouped by network/zone
   */
  function processBids(bids) {
    const dispatcher = new Dispatcher();
    //process individual bids
    utils._each(bids, (bid) => {
      if (!validateBidParams(bid.params)) {
        utils.logError(`Incorrect configuration for ${bid.bidder} bidder: ${bid.params}`);
        bidmanager.addBidResponse(bid.placementCode, createEmptyBidObject(bid));
      } else {
        dispatcher.addImp(bid);
      }
    });
    //process bids grouped into bid requests
    dispatcher.dispatch((id, bidRequest, tag) => {
      let adUnitId = id;
      if (tag) {
        utils.logMessage(`got response for ${adUnitId}`);
        bidmanager.addBidResponse(adUnitId, createBidObject(bidRequest, tag));
      } else {
        utils.logMessage(`got empty response for ${adUnitId}`);
        bidmanager.addBidResponse(adUnitId, createEmptyBidObject(bidRequest));
      }
    });
  }

  /**
   *  Create bid object for the bid manager
   */
  function createBidObject(bidRequest, tag) {
    return Object.assign(bidfactory.createBid(1, bidRequest), {
      bidderCode: bidRequest.bidder,
      ad: tag.tag,
      width: bidRequest.sizes[0][0],
      height: bidRequest.sizes[0][1],
      cpm: parseFloat(tag.bid)
    });
  }

  /**
   * Create empty bid object for the bid manager
   */
  function createEmptyBidObject(bidRequest) {
    return Object.assign(bidfactory.createBid(2, bidRequest), {
      bidderCode: bidRequest.bidder
    });
  }

  function validateBidParams(params) {
    return (typeof params.host === 'undefined' || typeof params.host === 'string') && typeof params.pubId === 'number';
  }

  return {
    callBids: baseAdapter.callBids,
    setBidderCode: baseAdapter.setBidderCode,
    getBidderCode : baseAdapter.getBidderCode,
    createNew : AdKernelDptAdapter.createNew
  };
};

/**
 * Creates new instance of AdKernel bidder adapter
 */
AdKernelDptAdapter.createNew = function() {
  return new AdKernelDptAdapter();
};

module.exports = AdKernelDptAdapter;
