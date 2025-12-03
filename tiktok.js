// Temp Email API - Cloudflare Workers Version
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  
  // Base URL for 1secmail service
  const baseUrl = "https://www.1secmail.com/api/v1/"
  
  // ============ GENERATE NEW TEMP EMAIL ============
  if (path === '/api/new' || path === '/new') {
    const domains = ["1secmail.com", "1secmail.org", "1secmail.net"]
    const randomString = Math.random().toString(36).substring(2, 12)
    const randomDomain = domains[Math.floor(Math.random() * domains.length)]
    const email = `${randomString}@${randomDomain}`
    
    return jsonResponse({
      success: true,
      email: email,
      timestamp: new Date().toISOString()
    })
  }
  
  // ============ CHECK INBOX ============
  if (path === '/api/inbox' || path === '/inbox') {
    const email = url.searchParams.get('email')
    
    if (!email || !email.includes('@')) {
      return jsonResponse({
        success: false,
        error: "Valid email parameter required"
      }, 400)
    }
    
    const [login, domain] = email.split('@')
    const inboxUrl = `${baseUrl}?action=getMessages&login=${login}&domain=${domain}`
    
    try {
      const response = await fetch(inboxUrl)
      const messages = await response.json()
      
      return jsonResponse({
        success: true,
        email: email,
        count: messages.length,
        messages: messages
      })
    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Failed to fetch inbox"
      }, 500)
    }
  }
  
  // ============ READ SPECIFIC EMAIL ============
  if (path === '/api/read' || path === '/read') {
    const email = url.searchParams.get('email')
    const id = url.searchParams.get('id')
    
    if (!email || !id) {
      return jsonResponse({
        success: false,
        error: "Email and id parameters required"
      }, 400)
    }
    
    const [login, domain] = email.split('@')
    const readUrl = `${baseUrl}?action=readMessage&login=${login}&domain=${domain}&id=${id}`
    
    try {
      const response = await fetch(readUrl)
      const emailData = await response.json()
      
      return jsonResponse({
        success: true,
        email: email,
        message: emailData
      })
    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Failed to read email"
      }, 500)
    }
  }
  
  // ============ DELETE EMAIL (Optional) ============
  if (path === '/api/delete' || path === '/delete') {
    const email = url.searchParams.get('email')
    const id = url.searchParams.get('id')
    
    if (!email || !id) {
      return jsonResponse({
        success: false,
        error: "Email and id parameters required"
      }, 400)
    }
    
    const [login, domain] = email.split('@')
    const deleteUrl = `${baseUrl}?action=deleteMessage&login=${login}&domain=${domain}&id=${id}`
    
    try {
      const response = await fetch(deleteUrl)
      const result = await response.text()
      
      return jsonResponse({
        success: true,
        message: "Email deleted successfully",
        result: result
      })
    } catch (error) {
      return jsonResponse({
        success: false,
        error: "Failed to delete email"
      }, 500)
    }
  }
  
  // ============ API DOCUMENTATION ============
  if (path === '/' || path === '/help') {
    return jsonResponse({
      api_name: "Temp Mail API",
      endpoints: {
        "Create new email": "/api/new",
        "Check inbox": "/api/inbox?email=your@email.com",
        "Read email": "/api/read?email=your@email.com&id=123",
        "Delete email": "/api/delete?email=your@email.com&id=123"
      },
      example: {
        "create": "https://your-worker.workers.dev/api/new",
        "inbox": "https://your-worker.workers.dev/api/inbox?email=abc123@1secmail.com",
        "read": "https://your-worker.workers.dev/api/read?email=abc123@1secmail.com&id=123456"
      }
    })
  }
  
  // ============ DEFAULT: 404 NOT FOUND ============
  return jsonResponse({
    success: false,
    error: "Endpoint not found",
    available_endpoints: ["/new", "/inbox", "/read", "/delete", "/help"]
  }, 404)
}

// Helper function to create JSON responses
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status: status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
