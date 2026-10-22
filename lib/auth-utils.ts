// Utility functions for authentication and unauthorized handling

/**
 * Handles unauthorized access by clearing tokens and redirecting to login
 */
export function handleUnauthorized() {
  // Clear all authentication data
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    
    // Clear any other auth-related data
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('user_data')
  }

  // Redirect to login page
  redirectToLogin()
}

/**
 * Redirects user to login page with proper error handling
 */
export function redirectToLogin() {
  if (typeof window !== 'undefined') {
    try {
      // Add a small delay to ensure data is cleared
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 100)
    } catch (error) {
      console.error('Error redirecting to login:', error)
      // Fallback redirect
      window.location.href = '/auth/login'
    }
  }
}

/**
 * Checks if user is authenticated by verifying token existence
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  
  const token = localStorage.getItem('auth_token')
  return !!token
}

/**
 * Gets the current authentication token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  
  return localStorage.getItem('auth_token')
}

/**
 * Gets the role name of the current user from the JWT payload (lowercased).
 * JWT payload is base64 encoded, not encrypted, so it can be read on the client.
 * Returns null when there is no token or the token cannot be decoded.
 */
export function getAuthRoleName(): string | null {
  const token = getAuthToken()
  if (!token) {
    return null
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    const payload = JSON.parse(atob(parts[1]))
    const roleName = payload?.roleName
    return typeof roleName === 'string' ? roleName.toLowerCase() : null
  } catch (error) {
    console.error('Error decoding auth token:', error)
    return null
  }
}

/**
 * Clears all authentication data
 */
export function clearAuthData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('user_data')
  }
}
