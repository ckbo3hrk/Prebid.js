import bidmanager from 'src/bidmanager';
import bidfactory from 'src/bidfactory';
import * as utils from 'src/utils';
import Adapter from 'src/adapters/adapter';

import {collectAnalytics} from 'src/adapters/analytics/adkernel';

/**
 * Adapter for requesting bids from AdKernel white-label platform
 * @class
 */
const AdKernelAdapter = function AdKernelAdapter() {

  let baseAdapter = Adapter.createNew('adkernelDSP');

  /**
   *  Main module export function implementation
   */
  baseAdapter.callBids = function (params) {
    let bids = params.bids || [];
    let analyticsInfo = collectAnalytics();
    let queryUrl = `//dsp.adkernel.com/tag?${analyticsInfo}&bids={bids go here}`;
    console.log(`Adkernel bidder adapter is performing query to ${queryUrl}`);
    utils._each(bids, (bid) => {
      bidmanager.addBidResponse(bid.bidderCode, createEmptyBidObject(bid));
    });
  };

  /**
   * Create empty bid object for the bid manager
   */
  function createEmptyBidObject(bid) {
    return utils.extend(bidfactory.createBid(2, bid), {
      bidderCode: bid.bidder
    });
  }

  return {
    callBids: baseAdapter.callBids,
    setBidderCode: baseAdapter.setBidderCode,
    getBidderCode : baseAdapter.getBidderCode,
    createNew : AdKernelAdapter.createNew
  };
};

/**
 * Creates new instance of AdKernel bidder adapter
 */
AdKernelAdapter.createNew = function() {
  return new AdKernelAdapter();
};

module.exports = AdKernelAdapter;
