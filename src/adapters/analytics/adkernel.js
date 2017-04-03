import adapter from 'AnalyticsAdapter';
const utils = require('../../utils');
const EVENTS = require('../../constants.json').EVENTS;

const analyticsType = 'bundle';

let isAnalyticsSent = false;

function collectAnalytics() {
  return `ref=${encodeURIComponent(document.referrer)}&secure=${location.protocol === 'https:'}`;
}

exports.collectAnalytics = collectAnalytics;

export default utils.extend(adapter({analyticsType}), {
  // Override AnalyticsAdapter functions by supplying custom methods
  track({ eventType, args }) {
    if (eventType === EVENTS.AUCTION_END) {
      if (isAnalyticsSent) {
        console.log('Adkernel analytics doing nothing because analytics information has been already sent');
      } else {
        let queryUrl = `//dsp.adkernel.com/tag?${collectAnalytics()}`;
        console.log(`Adkernel analytics adapter is performing query to ${queryUrl}`);
      }
    } else if (eventType === EVENTS.BID_REQUESTED) {
      if (args.bidderCode === 'adkernelDSP') {
        isAnalyticsSent = true;
      }
    }
  }
});
