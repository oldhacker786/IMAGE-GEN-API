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
      // Step 3: Try multiple approaches
      
      // Approach 1: Direct URL with proper parameters
      const simsUrl = `https://cnic.sims.pk/SIMInformationD.php`;
      
      const formData = new URLSearchParams();
      formData.append('CNIC', cnic);
      formData.append('MV', '1');
      formData.append('TV', '0');
      formData.append('UV', '3');
      formData.append('WV', '0');
      formData.append('ZV', '1');
      formData.append('MD', '1');
      formData.append('TD', '0');
      formData.append('UD', '0');
      formData.append('WD', '0');
      formData.append('ZD', '0');
      formData.append('TTV', '5');
      formData.append('TTD', '1');

      const response = await fetch(simsUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://cnic.sims.pk/',
          'Origin': 'https://cnic.sims.pk',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        },
        body: formData.toString()
      });

      const html = await response.text();
      
      // Check if we got a valid response or CAPTCHA page
      if (html.includes('recaptcha') || html.includes('captcha') || html.includes('Verify')) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "CAPTCHA verification required",
            data: {
              cnic: cnic,
              note: "Official PTA website requires CAPTCHA verification which cannot be automated",
              solutions: [
                {
                  method: "SMS Service",
                  instruction: "Send SMS: N [CNIC] to 668",
                  example: `N ${cnic}`,
                  cost: "Rs. 2 + tax"
                },
                {
                  method: "Official Website", 
                  url: "https://cnic.sims.pk",
                  instruction: "Visit website and complete CAPTCHA manually"
                },
                {
                  method: "PTA Mobile App",
                  instruction: "Download PTA SIM Information App"
                }
              ]
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

      // Step 4: Parse the response if we got data
      const resultData = parseSimsData(html, cnic);

      // If no data found in HTML, return informative message
      if (resultData.sim_details.total_numbers === 0) {
        return new Response(
          JSON.stringify({
            status: "success",
            data: {
              cnic: cnic,
              message: "No SIMs registered with this CNIC",
              note: "This CNIC has no active SIM registrations",
              verification: "You can verify by sending SMS to 668",
              credit: "@old_studio786"
            }
          }, null, 2),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      // Step 5: Create final response with successful data
      const result = {
        status: "success",
        data: resultData,
        source: "cnic.sims.pk",
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
          error: error.message,
          suggestion: "Please try the SMS service: Send 'N [CNIC]' to 668",
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

// Parse cnic.sims.pk HTML data
function parseSimsData(html, cnic) {
  const networks = [];
  
  // Extract CNIC from HTML
  let extractedCnic = cnic;
  const cnicMatch = html.match(/ID Card Number:&nbsp;\s*(\d+)/);
  if (cnicMatch) {
    extractedCnic = cnicMatch[1];
  }

  // Extract Date
  let date = new Date().toLocaleDateString();
  const dateMatch = html.match(/Date :&nbsp;\s*([^<]+)</);
  if (dateMatch) {
    date = dateMatch[1].trim();
  }

  // Simple table parsing - look for network rows
  const networkRegex = /<td[^>]*>&nbsp;\s*(\w+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>/g;
  let match;
  
  while ((match = networkRegex.exec(html)) !== null) {
    const network = match[1];
    const voiceData = parseInt(match[2]) || 0;
    const dataOnly = parseInt(match[3]) || 0;
    const total = parseInt(match[4]) || 0;
    
    if (voiceData > 0 || dataOnly > 0 || total > 0) {
      networks.push({
        network: network,
        voiceData: voiceData,
        dataOnly: dataOnly,
        total: total
      });
    }
  }

  // Look for total row
  const totalRegex = /<td[^>]*>&nbsp;\s*Total<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>\s*<td[^>]*>(\d+)<\/td>/;
  const totalMatch = html.match(totalRegex);
  
  let totalVoice = 0, totalData = 0, totalAll = 0;
  
  if (totalMatch) {
    totalVoice = parseInt(totalMatch[1]) || 0;
    totalData = parseInt(totalMatch[2]) || 0;
    totalAll = parseInt(totalMatch[3]) || 0;
  }

  // Add total row if we have networks
  if (networks.length > 0 && totalAll > 0) {
    networks.push({
      network: "Total",
      voiceData: totalVoice,
      dataOnly: totalData,
      total: totalAll
    });
  }

  return {
    owner_info: {
      cnic: extractedCnic,
      date: date
    },
    sim_details: {
      total_numbers: totalAll,
      networks: networks.filter(n => n.network !== "Total"),
      summary: {
        totalVoiceData: totalVoice,
        totalDataOnly: totalData,
        overallTotal: totalAll
      }
    }
  };
    }
