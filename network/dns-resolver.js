
const dns = require('dns');
const { logger } = require('../utils/logHandler');
const { broadcast } = require('../broadcast');
const { promisify } = require('util');

// promises
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/**
 * The getIps function returns array of valid IP addresses on the BTC network
 *  - A DNS seed is taken as a parameter
 *  - dns.resolve4: resolves all IPv4 addresses of given DNS Seed
 *  - dns.resolve6: resolves all IPv6 addresses of given DNS Seed
 */
const getIps = async (dns_seed) => {

  const dnsSeed = String(dns_seed || '').trim();
  const ipv4 = [];
  const ipv6 = [];

  // Try resolve IPv4 addresses
  try {
    ipv4.push(...await dnsResolve4(dnsSeed));
  } catch (err) {
    logger('warn', `IPv4 lookup failed for ${dnsSeed}: ${err.code || err.message}`);
  }

  // Try resolve IPv6 addresses
  try {
    ipv6.push(...await dnsResolve6(dnsSeed));
  } catch (err) {
    // ENODATA/ENOTFOUND means no IPv6 addresses found (not an error) -> ignore silently
    if (err.code !== 'ENODATA' && err.code !== 'ENOTFOUND') {
      logger('warn',  `IPv6 lookup failed for ${dnsSeed}: ${err.code || err.message}`);
    }
  }

  // All resolved addresses
  const addresses = ipv4.concat(ipv6);

  if (addresses.length > 0) {
    logger('info', 'IPV4 Addresses:', JSON.stringify(ipv4));
    logger('info', 'IPV6 Addresses:', JSON.stringify(ipv6));

    // Broadcast DNS resolution to frontend
    broadcast({ type: 'dns-resolved', data: { seed: dnsSeed, ipv4: ipv4.length, ipv6: ipv6.length } });

    return addresses;
  }

  logger('error', 'No addresses returned:', dnsSeed);
  return [];
}; 


module.exports = getIps;
