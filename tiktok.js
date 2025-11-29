export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cnic = url.searchParams.get('cnic');

    // Step 1: Validate CNIC
    if (!cnic) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing CNIC parameter. Use ?cnic=YOUR_CNIC_NUMBER'
        }, null, 2),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Step 2: Validate CNIC format (13 digits)
    const cnicRegex = /^\d{13}$/;
    if (!cnicRegex.test(cnic)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid CNIC format. Must be 13 digits without dashes.'
        }, null, 2),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    try {
      // Step 3: Try multiple SIM database APIs
      console.log(`Fetching SIM data for CNIC: ${cnic}`);
      
      let resultData = null;
      
      // Try Source 1: RIDHA SIM Tracker (working source)
      try {
        console.log('Trying RIDHA SIM Tracker...');
        resultData = await fetchRidhaData(cnic);
        if (resultData && resultData.sim_details.total_numbers > 0) {
          console.log('Success from RIDHA SIM Tracker');
        }
      } catch (error) {
        console.log('RIDHA failed:', error.message);
      }

      // Try Source 2: Alternative SIM databases
      if (!resultData || resultData.sim_details.total_numbers === 0) {
        try {
          console.log('Trying alternative sources...');
          resultData = await fetchAlternativeData(cnic);
        } catch (error) {
          console.log('Alternative sources failed:', error.message);
        }
      }

      // If no data found, return informative message
      if (!resultData || resultData.sim_details.total_numbers === 0) {
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              cnic: cnic,
              message: "No SIMs found or unable to fetch data due to security restrictions",
              note: "Official PTA sources require CAPTCHA verification",
              official_links: [
                "https://cnic.sims.pk",
                "https://dirbs.pta.gov.pk",
                "https://siminfo.pta.gov.pk"
              ],
              manual_check: "Send 'N <CNIC>' to 668 for SIM information"
            },
            credit: "@old_studio786"
          }, null, 2),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Step 4: Create final response with successful data
      const result = {
        status: "success",
        data: resultData,
        source: "multiple_sources",
        timestamp: new Date().toISOString(),
        credit: "@old_studio786"
      };

      return new Response(
        JSON.stringify(result, null, 2),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          }
        }
      );

    } catch (error) {
      console.error('Error:', error);
      
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Service temporarily unavailable",
          suggestion: "Please try official PTA websites directly",
          credit: "@old_studio786"
        }, null, 2),
        {
          status: 503, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};

// Fetch data from RIDHA SIM Tracker
async function fetchRidhaData(cnic) {
  const simTrackerUrl = 'https://ridhasimtracker.com/result.php';
  
  // Prepare form data for POST request
  const formData = new URLSearchParams();
  formData.append('cnic', cnic);
  formData.append('submit', 'Check');

  const trackerResponse = await fetch(simTrackerUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://ridhasimtracker.com/',
      'Origin': 'https://ridhasimtracker.com'
    },
    body: formData.toString()
  });

  const html = await trackerResponse.text();
  
  return parseRidhaData(html, cnic);
}

// Parse RIDHA SIM Tracker data
function parseRidhaData(html, cnic) {
  const networks = [];
  
  // Network patterns
  const networkPatterns = [
    { name: "Jazz", regex: /Jazz[^0-9]*(\d+)/gi },
    { name: "Telenor", regex: /Telenor[^0-9]*(\d+)/gi },
    { name: "Ufone", regex: /Ufone[^0-9]*(\d+)/gi },
    { name: "Zong", regex: /Zong[^0-9]*(\d+)/gi }
  ];

  const networkCounts = {
    'Jazz': { voice: 0, data: 0 },
    'Telenor': { voice: 0, data: 0 },
    'Ufone': { voice: 0, data: 0 }, 
    'Zong': { voice: 0, data: 0 }
  };

  // Extract owner information
  const ownerInfo = extractOwnerInfo(html);

  // Search for network counts
  networkPatterns.forEach(pattern => {
    const matches = html.matchAll(pattern.regex);
    for (const match of matches) {
      const count = parseInt(match[1]) || 1;
      networkCounts[pattern.name].voice += count;
    }
  });

  // Also look for total SIM counts
  const totalSimRegex = /Total SIMs?[^0-9]*(\d+)/gi;
  const totalMatch = html.match(totalSimRegex);
  let totalSims = 0;
  
  if (totalMatch) {
    totalSims = parseInt(totalMatch[1]) || 0;
  }

  // Convert to networks array
  Object.keys(networkCounts).forEach(network => {
    if (networkCounts[network].voice > 0 || networkCounts[network].data > 0) {
      networks.push({
        network: network,
        voiceData: networkCounts[network].voice,
        dataOnly: networkCounts[network].data,
        total: networkCounts[network].voice + networkCounts[network].data
      });
    }
  });

  // If we have networks but no totals, calculate them
  if (networks.length > 0) {
    const totalVoice = networks.reduce((sum, net) => sum + net.voiceData, 0);
    const totalData = networks.reduce((sum, net) => sum + net.dataOnly, 0);
    const overallTotal = networks.reduce((sum, net) => sum + net.total, 0);
    
    networks.push({
      network: "Total",
      voiceData: totalVoice,
      dataOnly: totalData,
      total: overallTotal
    });
  }

  return {
    owner_info: {
      name: ownerInfo.name,
      cnic: cnic,
      father_name: ownerInfo.fatherName,
      address: ownerInfo.address
    },
    sim_details: {
      total_numbers: networks.find(n => n.network === "Total")?.total || totalSims,
      networks: networks.filter(n => n.network !== "Total"),
      numbers_list: extractMobileNumbers(html)
    },
    summary: {
      totalVoiceData: networks.find(n => n.network === "Total")?.voiceData || 0,
      totalDataOnly: networks.find(n => n.network === "Total")?.dataOnly || 0,
      overallTotal: networks.find(n => n.network === "Total")?.total || totalSims
    }
  };
}

// Extract owner information
function extractOwnerInfo(html) {
  const ownerInfo = {
    name: 'Not Available',
    fatherName: 'Not Available',
    address: 'Not Available'
  };

  // Extract Name
  const nameRegex = /Owner Name[^:]*:([^<]+)/gi;
  const nameMatch = html.match(nameRegex);
  if (nameMatch) {
    ownerInfo.name = nameMatch[0].split(':')[1]?.trim() || 'Not Available';
  }

  // Extract Father Name
  const fatherRegex = /Father Name[^:]*:([^<]+)/gi;
  const fatherMatch = html.match(fatherRegex);
  if (fatherMatch) {
    ownerInfo.fatherName = fatherMatch[0].split(':')[1]?.trim() || 'Not Available';
  }

  // Extract Address
  const addressRegex = /Address[^:]*:([^<]+)/gi;
  const addressMatch = html.match(addressRegex);
  if (addressMatch) {
    ownerInfo.address = addressMatch[0].split(':')[1]?.trim() || 'Not Available';
  }

  return ownerInfo;
}

// Extract mobile numbers
function extractMobileNumbers(html) {
  const numbers = [];
  const mobileRegex = /03\d{2}[-]?\d{7}/g;
  const matches = html.matchAll(mobileRegex);
  
  for (const match of matches) {
    numbers.push({
      number: match[0].replace(/-/g, ''),
      network: 'Unknown',
      status: 'Active'
    });
  }
  
  return numbers;
}

// Fetch from alternative sources
async function fetchAlternativeData(cnic) {
  // Add other working SIM database URLs here
  const alternativeUrls = [
    `https://paksiminfo.com/api/check/${cnic}`,
    `https://simdatabase.pk/api/sim-check/${cnic}`
  ];
  
  for (const url of alternativeUrls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.success) {
          return data;
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
                }
