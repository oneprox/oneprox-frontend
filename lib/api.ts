// Utility functions for API calls to oripro-backend

// Determine API URL based on environment
// For development (localhost), always use localhost:3001
// For production, use NEXT_PUBLIC_API_URL environment variable
// function getApiBaseUrl(): string {
//   // Check if we're accessing from localhost (client-side)
//   if (typeof window !== 'undefined') {
//     const hostname = window.location.hostname
//     const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
    
//     if (isLocalhost) {
//       // Always use localhost for development, ignore environment variable
//       const url = window.location.protocol === 'https:' 
//         ? 'https://localhost:3001' 
//         : 'http://localhost:3001'
//       console.log('[API] Development mode - Using localhost:', url)
//       return url
//     }
//   }
  
//   // For server-side rendering in development mode, use localhost
//   if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
//     const url = 'http://localhost:3001'
//     console.log('[API] Development mode (server-side) - Using localhost:', url)
//     return url
//   }
  
//   // For production, use environment variable
//   const url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
//   if (typeof window !== 'undefined') {
//     console.log('[API] Production mode - Using URL:', url)
//   }
//   return url
// }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.protocol === 'https:' 
    ? 'https://localhost:3001' 
    : 'http://localhost:3001') 

export interface ApiResponse<T = any> {
  success?: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    limit: number
    offset: number
  }
}

export class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token')
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`
    
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    }

    // Only set Content-Type for JSON data, not for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle 204 No Content response (for DELETE operations)
      if (response.status === 204) {
        return {
          success: true,
          data: undefined,
        }
      }

      // Try to parse JSON for other responses
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        // If JSON parsing fails, use response text or status
        data = { message: `HTTP ${response.status}` }
      }

      if (!response.ok) {
        // Handle 401 Unauthorized specifically
        if (response.status === 401) {
          // Clear token and redirect to login
          this.clearToken()
          if (typeof window !== 'undefined') {
            // Add a small delay to ensure token is cleared
            setTimeout(() => {
              window.location.href = '/auth/login'
            }, 100)
          }
          return {
            success: false,
            error: 'Unauthorized. Redirecting to login...',
          }
        }
        
        // Handle validation errors (400 Bad Request)
        if (response.status === 400 && data.errors && Array.isArray(data.errors)) {
          const errorMessages = data.errors.map((err: any) => 
            err.msg || `${err.param}: ${err.msg}`
          ).join(', ')
          return {
            success: false,
            error: errorMessages || data.message || `HTTP ${response.status}`,
            message: data.message,
          }
        }
        
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          message: data.message,
        }
      }

      // Handle backend response format
      if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
        // Backend returns { data: actualData, success: true, message: "...", pagination: {...} }
        return {
          success: data.success,
          data: data.data,
          message: data.message,
          // Include error/message in error field for consistency
          error: data.success ? undefined : (data.message || data.error),
          // Include pagination if present
          pagination: data.pagination,
        }
      }

      // Handle backend error format { success: false, message: "..." }
      if (data && typeof data === 'object' && 'success' in data && !data.success) {
        return {
          success: false,
          error: data.message || data.error || 'Terjadi kesalahan',
          message: data.message,
        }
      }

      // Handle nested response format (when backend wraps response in another data object)
      if (data && typeof data === 'object' && 'data' in data && typeof data.data === 'object' && 'data' in data.data) {
        return {
          success: data.data.success || true,
          data: data.data.data,
          message: data.data.message,
          error: data.data.success ? undefined : (data.data.message || data.data.error),
        }
      }

      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: 'Network error. Please try again.',
      }
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' })
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
    })
  }

  async putFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: formData,
    })
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}

// Create a default instance
export const apiClient = new ApiClient()

// Export api for backward compatibility
export const api = apiClient

// Auth-specific API functions
export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Login failed',
      }
    }

    return {
      success: true,
      data,
    }
  },

  async logout(): Promise<void> {
    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
    }
  },

  async getCurrentUser(): Promise<any> {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('user_data')
      return userData ? JSON.parse(userData) : null
    }
    return null
  },
}

// Role API interface
export interface Role {
  id: number
  name: string
  level: number
}

export interface CreateRoleData {
  name: string
  level: number
}

export interface UpdateRoleData {
  name?: string
  level?: number
}

// Users API interface
export interface User {
  id: string // UUID string
  email: string
  name?: string
  phone?: string
  gender?: string
  role_id?: number
  status?: string
  role?: {
    id: number
    name: string
    level: number
  }
  created_at: string
  updated_at: string
  created_by?: string // UUID string
  updated_by?: string // UUID string
}

// User Asset interface
export interface UserAsset {
  id: string
  user_id: string
  asset_id: string
  created_by?: string
  created_at: string
  asset?: Asset
  // Flattened asset data for easier access
  asset_name?: string
  asset_code?: string
  asset_address?: string
  asset_type?: number
  asset_status?: number
}

export interface CreateUserData {
  email: string
  password: string
  name?: string
  phone?: string
  gender?: string
  roleId?: string
  status?: string
}

export interface UpdateUserData {
  email?: string
  password?: string
  name?: string
  phone?: string
  gender?: string
  roleId?: string
  status?: string
}

// User Log interface
export interface UserLog {
  id: number
  user_id: string
  action: string
  old_data?: any
  new_data?: any
  created_by?: {
    id: string
    name: string
    email: string
  }
  role?: {
    id: number
    name: string
    level: number
  }
  created_at: string
}

// Asset Log interface
export interface AssetLog {
  id: number
  asset_id: string
  action: string
  old_data?: any
  new_data?: any
  created_by?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Unit Log interface
export interface UnitLog {
  id: number
  unit_id: string
  action: string
  old_data?: any
  new_data?: any
  created_by?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Tenant Log interface
export interface TenantLog {
  id: number
  tenant_id: string
  action: string
  old_data?: any
  new_data?: any
  created_by?: {
    id: string
    name: string
    email: string
  }
  user?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Tenant Deposit Log interface
export interface TenantDepositLog {
  id: number
  tenant_id: string
  reason?: string
  new_deposit?: number
  old_deposit?: number
  old_data?: {
    deposit?: number
    old_deposit?: number
    amount?: number
  }
  created_by?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Tenant Payment Log interface
export interface TenantPaymentLog {
  id: number
  tenant_id: string
  amount?: number
  paid_amount?: number
  payment_date?: string
  payment_deadline?: string
  payment_method?: string
  notes?: string
  status?: number // 0 for unpaid, 1 for paid, 2 for expired
  updatedBy?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Create Tenant Payment Data interface
export interface CreateTenantPaymentData {
  amount: number
  payment_method: string
  notes?: string
}

// Update Tenant Payment Data interface
export interface UpdateTenantPaymentData {
  payment_date?: string
  payment_method?: string
  notes?: string
  paid_amount?: number
}

// Roles-specific API functions
export const rolesApi = {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    return apiClient.get<Role[]>('/api/roles')
  },

  async getRole(id: string): Promise<ApiResponse<Role>> {
    return apiClient.get<Role>(`/api/roles/${id}`)
  },

  async createRole(data: CreateRoleData): Promise<ApiResponse<Role>> {
    return apiClient.post<Role>('/api/roles', data)
  },

  async updateRole(id: string, data: UpdateRoleData): Promise<ApiResponse<Role>> {
    return apiClient.put<Role>(`/api/roles/${id}`, data)
  },

  async deleteRole(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/roles/${id}`)
  },
}

// Users-specific API functions
export const usersApi = {
  async getUsers(params?: {
    name?: string
    email?: string
    role_id?: string
    status?: string
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<User[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.email) queryParams.append('email', params.email)
    if (params?.role_id) queryParams.append('role_id', params.role_id)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/users${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<User[]>(endpoint)
  },

  async getUser(id: string): Promise<ApiResponse<User>> {
    console.log("get user api")
    return apiClient.get<User>(`/api/users/${id}`)
  },

  async createUser(data: CreateUserData): Promise<ApiResponse<User>> {
    return apiClient.post<User>('/api/users', data)
  },

  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<User>> {
    return apiClient.put<User>(`/api/users/${id}`, data)
  },

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/users/${id}`)
  },

  async getUserPermissions(): Promise<ApiResponse<{ permissions: any[] }>> {
    return apiClient.get<{ permissions: any[] }>('/api/users/permissions')
  },

  async getUserMenus(): Promise<ApiResponse<{ menus: any[] }>> {
    return apiClient.get<{ menus: any[] }>('/api/users/menus')
  },

  async checkMenuAccess(url: string): Promise<ApiResponse<{ hasAccess: boolean }>> {
    const queryParams = new URLSearchParams()
    queryParams.append('url', url)
    return apiClient.get<{ hasAccess: boolean }>(`/api/users/check-menu-access?${queryParams.toString()}`)
  },

  async getUserSidebar(): Promise<ApiResponse<{ navMain: any[] }>> {
    return apiClient.get<{ navMain: any[] }>('/api/users/sidebar')
  },

  async getUserLogs(userId: string): Promise<ApiResponse<UserLog[]>> {
    return apiClient.get<UserLog[]>(`/api/users/${userId}/logs`)
  },

  async getUserAssets(userId: string): Promise<ApiResponse<UserAsset[]>> {
    return apiClient.get<UserAsset[]>(`/api/users/${userId}/assets`)
  },
}

// Asset API interface
export interface Asset {
  id: string
  name: string
  code: string
  description?: string
  asset_type: number | string
  status: number | string
  address: string
  area: number
  longitude: number
  latitude: number
  photos?: string[]
  sketch?: string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

export interface CreateAssetData {
  name: string
  description?: string
  asset_type: number
  address: string
  area: number
  longitude: number
  latitude: number
  status?: number
}

export interface UpdateAssetData {
  name?: string
  code?: string
  description?: string
  asset_type?: number
  address?: string
  area?: number
  longitude?: number
  latitude?: number
  status?: number
}

// Asset type constants
export const ASSET_TYPES = {
  ESTATE: 1,
  OFFICE: 2,
  WAREHOUSE: 3,
  SPORT: 4,
  ENTERTAINMENTRESTAURANT: 5,
  RESIDENCE: 6,
  MALL: 7,
  SUPPORTFACILITYMOSQUEITAL: 8,
  PARKINGLOT: 9,
}

export const ASSET_TYPE_LABELS = {
  [ASSET_TYPES.ESTATE]: 'Estate',
  [ASSET_TYPES.OFFICE]: 'Office',
  [ASSET_TYPES.WAREHOUSE]: 'Warehouse',
  [ASSET_TYPES.SPORT]: 'Sport',
  [ASSET_TYPES.ENTERTAINMENTRESTAURANT]: 'Entertainment/Restaurant',
  [ASSET_TYPES.RESIDENCE]: 'Residence',
  [ASSET_TYPES.MALL]: 'Mall',
  [ASSET_TYPES.SUPPORTFACILITYMOSQUEITAL]: 'Support Facility/Mosque',
  [ASSET_TYPES.PARKINGLOT]: 'Parking Lot',
}

// Assets-specific API functions
export const assetsApi = {
  async getAssets(params?: {
    name?: string
    asset_type?: number
    status?: number
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<Asset[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.asset_type) queryParams.append('asset_type', params.asset_type.toString())
    if (params?.status !== undefined && params?.status !== null) {
      queryParams.append('status', params.status.toString())
    }
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/assets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<Asset[]>(endpoint)
  },

  async getAsset(id: string): Promise<ApiResponse<Asset>> {
    return apiClient.get<Asset>(`/api/assets/${id}`)
  },

  async createAsset(data: CreateAssetData | FormData): Promise<ApiResponse<Asset>> {
    // If data is FormData, use direct fetch to avoid JSON serialization
    if (data instanceof FormData) {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/assets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: data,
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: result,
      };
    }
    
    return apiClient.post<Asset>('/api/assets', data)
  },

  async updateAsset(id: string, data: UpdateAssetData | FormData): Promise<ApiResponse<Asset>> {
    // If data is FormData, use direct fetch to avoid JSON serialization
    if (data instanceof FormData) {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/assets/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: data,
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        data: result,
      };
    }
    
    return apiClient.put<Asset>(`/api/assets/${id}`, data)
  },

  async deleteAsset(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/assets/${id}`)
  },

  async getAssetLogs(assetId: string): Promise<ApiResponse<AssetLog[]>> {
    return apiClient.get<AssetLog[]>(`/api/assets/${assetId}/logs`)
  },
}

// Attendance API interfaces
export interface Attendance {
  id: number
  user_id: string
  asset_id: number
  check_in_time: string
  check_out_time?: string
  check_in_latitude: number
  check_in_longitude: number
  check_out_latitude?: number
  check_out_longitude?: number
  status: 'checked_in' | 'checked_out'
  notes?: string
  created_at: string
  updated_at: string
  asset: {
    id: number
    name: string
    code: string
    address: string
  }
}

export interface AttendanceStatus {
  id?: number
  check_in_time?: string
  check_out_time?: string
  status: 'checked_in' | 'checked_out' | 'not_checked_in'
  hasCheckedIn?: boolean
  hasCheckedOut?: boolean
  attendance?: {
    id: number
    check_in_time: string
    check_out_time?: string
    status: 'checked_in' | 'checked_out'
    asset?: {
      id: number
      name: string
      code: string
      address: string
    }
  }
  asset?: {
    id: number
    name: string
    code: string
    address: string
  }
}

export interface CheckRadiusResponse {
  isInRadius: boolean
  distance: number
}

// Attendance API functions
export const attendanceApi = {
  async checkRadius(latitude: number, longitude: number, assetId: number | string): Promise<ApiResponse<CheckRadiusResponse>> {
    return apiClient.post<CheckRadiusResponse>('/api/attendances/check-radius', {
      latitude,
      longitude,
      asset_id: assetId
    })
  },

  async checkIn(assetId: number | string, latitude: number, longitude: number, notes?: string): Promise<ApiResponse<Attendance>> {
    // Validate assetId - can be UUID (string) or number
    if (!assetId || assetId === null || assetId === undefined) {
      return Promise.resolve({
        success: false,
        error: 'Asset ID tidak valid'
      })
    }

    // Convert to string for validation, but keep original type
    const asset_id = assetId

    if (typeof latitude !== 'number' || isNaN(latitude)) {
      return Promise.resolve({
        success: false,
        error: 'Latitude tidak valid'
      })
    }

    if (typeof longitude !== 'number' || isNaN(longitude)) {
      return Promise.resolve({
        success: false,
        error: 'Longitude tidak valid'
      })
    }

    return apiClient.post<Attendance>('/api/attendances/check-in', {
      asset_id,
      latitude,
      longitude,
      notes
    })
  },

  async checkOut(assetId: number | string, latitude: number, longitude: number, notes?: string): Promise<ApiResponse<Attendance>> {
    // Validate assetId - can be UUID (string) or number
    if (!assetId || assetId === null || assetId === undefined) {
      return Promise.resolve({
        success: false,
        error: 'Asset ID tidak valid'
      })
    }

    // Convert to string for validation, but keep original type
    const asset_id = assetId

    if (typeof latitude !== 'number' || isNaN(latitude)) {
      return Promise.resolve({
        success: false,
        error: 'Latitude tidak valid'
      })
    }

    if (typeof longitude !== 'number' || isNaN(longitude)) {
      return Promise.resolve({
        success: false,
        error: 'Longitude tidak valid'
      })
    }

    return apiClient.post<Attendance>('/api/attendances/check-out', {
      asset_id,
      latitude,
      longitude,
      notes
    })
  },

  async getTodayStatus(assetId: number | string): Promise<ApiResponse<AttendanceStatus>> {
    // Validate assetId - can be UUID (string) or number
    if (!assetId || assetId === null || assetId === undefined) {
      return Promise.resolve({
        success: false,
        error: 'Asset ID tidak valid'
      })
    }

    // Keep original type (UUID string or number)
    const id = assetId

    return apiClient.get<AttendanceStatus>(`/api/attendances/today-status/${id}`)
  },

  async getUserAttendanceHistory(limit?: number): Promise<ApiResponse<Attendance[]>> {
    const queryParams = limit ? `?limit=${limit}` : ''
    return apiClient.get<Attendance[]>(`/api/attendances/history${queryParams}`)
  },

  async getUserAttendanceHistoryByDate(userId?: string, dateFrom?: string, dateTo?: string): Promise<ApiResponse<Attendance[]>> {
    const queryParams = new URLSearchParams()
    if (userId) queryParams.append('user_id', userId)
    if (dateFrom) queryParams.append('date_from', dateFrom)
    if (dateTo) queryParams.append('date_to', dateTo)
    const queryString = queryParams.toString()
    return apiClient.get<Attendance[]>(`/api/attendances/history${queryString ? `?${queryString}` : ''}`)
  },

  async getWeeklyHistory(assetId: number | string): Promise<ApiResponse<Attendance[]>> {
    // Validate assetId - can be UUID (string) or number
    if (!assetId || assetId === null || assetId === undefined) {
      return Promise.resolve({
        success: false,
        error: 'Asset ID tidak valid'
      })
    }

    // Keep original type (UUID string or number)
    const id = assetId

    return apiClient.get<Attendance[]>(`/api/attendances/weekly-history?asset_id=${id}`)
  }
}

// Unit API interface
export interface Unit {
  id: string
  asset_id: string
  name: string
  size: number
  building_area?: number
  rent_price: number
  lamp: number
  electric_socket: number
  electrical_power: number
  electrical_unit: string
  is_toilet_exist: boolean
  description?: string
  is_deleted: boolean
  status?: string // 0 for available, 1 for rented, etc.
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
  asset?: Asset
}

export interface CreateUnitData {
  name: string
  asset_id: string
  size: number
  building_area?: number
  rent_price: number
  lamp?: number
  electric_socket?: number
  electrical_power: number
  electrical_unit?: string
  is_toilet_exist: boolean
  description?: string
}

export interface UpdateUnitData {
  name?: string
  size?: number
  building_area?: number
  rent_price?: number
  lamp?: number
  electric_socket?: number
  electrical_power?: number
  electrical_unit?: string
  is_toilet_exist?: boolean
  description?: string
}

// Units-specific API functions
export const unitsApi = {
  async getUnits(params?: {
    name?: string
    asset_id?: string
    is_deleted?: boolean
    status?: number
    size_min?: number
    size_max?: number
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<Unit[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.asset_id) queryParams.append('asset_id', params.asset_id)
    if (params?.is_deleted !== undefined) queryParams.append('is_deleted', params.is_deleted.toString())
    if (params?.status !== undefined && params?.status !== null) queryParams.append('status', params.status.toString())
    if (params?.size_min) queryParams.append('size_min', params.size_min.toString())
    if (params?.size_max) queryParams.append('size_max', params.size_max.toString())
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/units${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<Unit[]>(endpoint)
  },

  async getUnit(id: string): Promise<ApiResponse<Unit>> {
    return apiClient.get<Unit>(`/api/units/${id}`)
  },

  async createUnit(data: CreateUnitData): Promise<ApiResponse<Unit>> {
    return apiClient.post<Unit>('/api/units', data)
  },

  async updateUnit(id: string, data: UpdateUnitData): Promise<ApiResponse<Unit>> {
    return apiClient.put<Unit>(`/api/units/${id}`, data)
  },

  async deleteUnit(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/units/${id}`)
  },

  async getUnitLogs(unitId: string): Promise<ApiResponse<UnitLog[]>> {
    return apiClient.get<UnitLog[]>(`/api/units/${unitId}/logs`)
  },
}

// Tenant API interface
export interface Tenant {
  id: string
  name: string
  user_id: string
  contract_begin_at: string
  contract_end_at: string
  rent_duration: number
  rent_duration_unit: string
  code: string
  rent_price?: number
  down_payment?: number
  deposit?: number
  payment_term?: string
  status?: string // 'inactive' | 'active' | 'pending' | 'expired' | 'terminated' | 'blacklisted'
  payment_status?: 'paid' | 'scheduled' | 'reminder_needed' | 'overdue'
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
  user?: User
  tenant_identifications?: string[]
  contract_documents?: string[]
  unit_ids?: string[]
  units?: Unit[]
  category?: {
    id: number
    name: string
  }
  categories?: number[] | any[] // Keep for backward compatibility
}

export interface CreateTenantData {
  name: string
  user_id: string
  contract_begin_at: string
  rent_duration: number
  rent_duration_unit: number
  tenant_identifications: string[]
  contract_documents: string[]
  unit_ids: string[]
  category_id: number
  rent_price?: number
  down_payment?: number
  deposit?: number
  payment_term?: number
  price_per_term?: number
}

export interface UpdateTenantData {
  name?: string
  user_id?: string
  contract_begin_at?: string
  rent_duration?: number
  rent_duration_unit?: string
  tenant_identifications?: string[]
  contract_documents?: string[]
  unit_ids?: string[]
  categories?: number[]
  rent_price?: number
  down_payment?: number
  deposit?: number
  deposit_reason?: string
  status?: string // 'inactive' | 'active' | 'pending' | 'expired' | 'terminated' | 'blacklisted'
}

// Duration unit constants
export const DURATION_UNITS = {
  YEAR: 'year',
  MONTH: 'month'
}

export const DURATION_UNIT_LABELS = {
  [DURATION_UNITS.YEAR]: 'Tahun',
  [DURATION_UNITS.MONTH]: 'Bulan'
}

// Tenants-specific API functions
export const tenantsApi = {
  async getTenants(params?: {
    name?: string
    user_id?: string
    category?: number | string
    status?: number | string
    payment_status?: string
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<Tenant[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.user_id) queryParams.append('user_id', params.user_id)
    if (params?.category) queryParams.append('category', params.category.toString())
    if (params?.status !== undefined && params?.status !== null) {
      queryParams.append('status', params.status.toString())
    }
    if (params?.payment_status) queryParams.append('payment_status', params.payment_status)
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/tenants${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<Tenant[]>(endpoint)
  },

  async getTenant(id: string): Promise<ApiResponse<Tenant>> {
    return apiClient.get<Tenant>(`/api/tenants/${id}`)
  },

  async createTenant(data: CreateTenantData): Promise<ApiResponse<Tenant>> {
    return apiClient.post<Tenant>('/api/tenants', data)
  },

  async updateTenant(id: string, data: UpdateTenantData): Promise<ApiResponse<Tenant>> {
    return apiClient.put<Tenant>(`/api/tenants/${id}`, data)
  },

  async deleteTenant(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/tenants/${id}`)
  },

  async uploadTenantFile(file: File, type: 'identification' | 'contract'): Promise<ApiResponse<{url: string, filename: string, type: string}>> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type === 'identification' ? '1' : '2')
    
    
    // Use apiClient.post with FormData
    return apiClient.post<{url: string, filename: string, type: string}>('/api/uploads/tenants', formData);
  },

  async saveTenantAttachment(tenantId: string, url: string, attachmentType: number): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/api/tenants/${tenantId}/attachments`, {
      tenant_id: tenantId,
      url,
      attachment_type: attachmentType
    })
  },

  async getTenantLogs(tenantId: string): Promise<ApiResponse<TenantLog[]>> {
    return apiClient.get<TenantLog[]>(`/api/tenants/${tenantId}/logs`)
  },

  async getTenantDepositLogs(tenantId: string): Promise<ApiResponse<TenantDepositLog[]>> {
    return apiClient.get<TenantDepositLog[]>(`/api/tenants/${tenantId}/deposito-logs`)
  },

  async getTenantPaymentLogs(tenantId: string, params?: {
    limit?: number
    offset?: number
    status?: number
  }): Promise<ApiResponse<TenantPaymentLog[]>> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.status !== undefined && params?.status !== null) queryParams.append('status', params.status.toString())
    
    const endpoint = `/api/tenants/${tenantId}/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<TenantPaymentLog[]>(endpoint)
  },

  async createTenantPayment(tenantId: string, data: CreateTenantPaymentData): Promise<ApiResponse<TenantPaymentLog>> {
    return apiClient.post<TenantPaymentLog>(`/api/tenants/${tenantId}/payments`, data)
  },

  async updateTenantPayment(tenantId: string, paymentId: number, data: UpdateTenantPaymentData): Promise<ApiResponse<TenantPaymentLog>> {
    return apiClient.put<TenantPaymentLog>(`/api/tenants/${tenantId}/payments/${paymentId}`, data)
  },
}

// Menus-specific API functions
export const menusApi = {
  async getMenus(params?: {
    title?: string
    is_active?: boolean
    parent_id?: number | null
    has_parent?: boolean
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<Menu[]>> {
    const queryParams = new URLSearchParams()
    if (params?.title) queryParams.append('title', params.title)
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString())
    if (params?.parent_id !== undefined) queryParams.append('parent_id', params.parent_id?.toString() || 'null')
    if (params?.has_parent !== undefined) queryParams.append('has_parent', params.has_parent.toString())
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/menus${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<Menu[]>(endpoint)
  },

  async getMenu(id: string): Promise<ApiResponse<Menu>> {
    return apiClient.get<Menu>(`/api/menus/${id}`)
  },

  async createMenu(data: CreateMenuData): Promise<ApiResponse<Menu>> {
    return apiClient.post<Menu>('/api/menus', data)
  },

  async updateMenu(id: string, data: UpdateMenuData): Promise<ApiResponse<Menu>> {
    return apiClient.put<Menu>(`/api/menus/${id}`, data)
  },

  async deleteMenu(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/menus/${id}`)
  },
}

// Menu API interface
export interface Menu {
  id: number
  title: string
  url?: string
  icon?: string
  parent_id?: number
  order: number
  is_active: boolean
  can_view: boolean
  can_add: boolean
  can_edit: boolean
  can_delete: boolean
  can_confirm: boolean
  created_at: string
  updated_at: string
  created_by?: number
  updated_by?: number
  children?: Menu[]
}

export interface CreateMenuData {
  title: string
  url?: string
  icon?: string
  parent_id?: number
  order?: number
  is_active?: boolean
  can_view?: boolean
  can_add?: boolean
  can_edit?: boolean
  can_delete?: boolean
  can_confirm?: boolean
}

export interface UpdateMenuData {
  title?: string
  url?: string
  icon?: string
  parent_id?: number
  order?: number
  is_active?: boolean
  can_view?: boolean
  can_add?: boolean
  can_edit?: boolean
  can_delete?: boolean
  can_confirm?: boolean
}

export interface CreateRoleMenuPermissionData {
  menu_id: number
  can_view: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
  can_confirm: boolean
}

// Menu Access interface
export interface MenuAccess {
  id: string
  name: string
  path: string
  icon?: string
  children?: MenuAccess[]
  hasAccess: boolean
}

// Task Group API interface
export interface TaskGroup {
  id: number
  name: string
  description?: string
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
  updated_at: string
  parent_tasks?: TaskWithUserTasks[]
  child_tasks?: TaskWithUserTasks[]
}

export interface TaskWithUserTasks extends Task {
  user_tasks?: UserTask[]
  child_tasks?: TaskWithUserTasks[]
}

export interface CreateTaskGroupData {
  name: string
  description?: string
  start_time: string
  end_time: string
  is_active?: boolean
}

export interface UpdateTaskGroupData {
  name?: string
  description?: string
  start_time?: string
  end_time?: string
  is_active?: boolean
}

// Task API interface
export interface Task {
  id: number | string
  name: string
  is_main_task: boolean
  is_need_validation: boolean
  is_scan: boolean
  scan_code?: string | null
  duration: number
  asset_id: string
  role_id: number
  is_all_times: boolean
  parent_task_id?: number | string
  parent_task_ids?: number[] | string[]
  task_group_id?: number | string | null
  days?: number[]
  times?: string[]
  created_at?: string
  updated_at?: string
  created_by?: string
  asset?: Asset
  role?: Role
  parent_task?: Task
  task_group?: TaskGroup
}

export interface CreateTaskData {
  name: string
  is_main_task?: boolean
  is_need_validation?: boolean
  is_scan?: boolean
  scan_code?: string
  duration: number
  asset_id: string
  role_id: number
  is_all_times?: boolean
  parent_task_id?: number
  parent_task_ids?: number[]
  task_group_id?: number
  days?: number[]
  times?: string[]
}

export interface UpdateTaskData {
  name?: string
  is_main_task?: boolean
  is_need_validation?: boolean
  is_scan?: boolean
  scan_code?: string
  duration?: number
  asset_id?: string
  role_id?: number
  is_all_times?: boolean
  parent_task_id?: number
  parent_task_ids?: number[]
  task_group_id?: number
  days?: number[]
  times?: string[]
}

// Task Log interface
export interface TaskLog {
  id: number
  task_id: number
  action: string
  old_data?: any
  new_data?: any
  created_by?: {
    id: string
    name: string
    email: string
  }
  created_at: string
}

// Task Groups-specific API functions
export const taskGroupsApi = {
  async getTaskGroups(params?: {
    name?: string
    is_active?: boolean
    order?: 'newest' | 'oldest' | 'a-z' | 'z-a'
    limit?: number
    offset?: number
  }): Promise<ApiResponse<TaskGroup[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString())
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/task-groups${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<TaskGroup[]>(endpoint)
  },

  async getTaskGroup(id: number): Promise<ApiResponse<TaskGroup>> {
    return apiClient.get<TaskGroup>(`/api/task-groups/${id}`)
  },

  async createTaskGroup(data: CreateTaskGroupData): Promise<ApiResponse<TaskGroup>> {
    return apiClient.post<TaskGroup>('/api/task-groups', data)
  },

  async updateTaskGroup(id: number, data: UpdateTaskGroupData): Promise<ApiResponse<TaskGroup>> {
    return apiClient.put<TaskGroup>(`/api/task-groups/${id}`, data)
  },

  async deleteTaskGroup(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/task-groups/${id}`)
  },

  async getTaskGroupsForWork(): Promise<ApiResponse<UserTask[]>> {
    return apiClient.get<UserTask[]>('/api/user-tasks')
  },
}

// Tasks-specific API functions
export const tasksApi = {
  async getTasks(params?: {
    name?: string
    asset_id?: string
    role_id?: number
    task_group_id?: number
    is_main_task?: boolean
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<Task[]>> {
    const queryParams = new URLSearchParams()
    if (params?.name) queryParams.append('name', params.name)
    if (params?.asset_id) queryParams.append('asset_id', params.asset_id)
    if (params?.role_id) queryParams.append('role_id', params.role_id.toString())
    if (params?.task_group_id) queryParams.append('task_group_id', params.task_group_id.toString())
    if (params?.is_main_task !== undefined) queryParams.append('is_main_task', params.is_main_task.toString())
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<Task[]>(endpoint)
  },

  async getTask(id: number): Promise<ApiResponse<Task>> {
    return apiClient.get<Task>(`/api/tasks/${id}`)
  },

  async createTask(data: CreateTaskData): Promise<ApiResponse<Task>> {
    return apiClient.post<Task>('/api/tasks', data)
  },

  async updateTask(id: number, data: UpdateTaskData): Promise<ApiResponse<Task>> {
    return apiClient.put<Task>(`/api/tasks/${id}`, data)
  },

  async deleteTask(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/tasks/${id}`)
  },

  async getTaskLogs(taskId: number): Promise<ApiResponse<TaskLog[]>> {
    return apiClient.get<TaskLog[]>(`/api/tasks/${taskId}/logs`)
  },
}

// Scan Info API interface
export interface ScanInfo {
  id: number
  scan_code: string
  latitude: number
  longitude: number
  asset_id: string
  created_at?: string
  updated_at?: string
  asset?: Asset
}

export interface CreateScanInfoData {
  scan_code: string
  latitude: number
  longitude: number
  asset_id: string
}

export interface UpdateScanInfoData {
  scan_code?: string
  latitude?: number
  longitude?: number
  asset_id?: string
}

// Scan Info-specific API functions
export const scanInfoApi = {
  async getScanInfos(params?: {
    scan_code?: string
    asset_id?: string
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<ScanInfo[]>> {
    const queryParams = new URLSearchParams()
    if (params?.scan_code) queryParams.append('scan_code', params.scan_code)
    if (params?.asset_id) queryParams.append('asset_id', params.asset_id)
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/scan-infos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<ScanInfo[]>(endpoint)
  },

  async getScanInfo(id: number): Promise<ApiResponse<ScanInfo>> {
    return apiClient.get<ScanInfo>(`/api/scan-infos/${id}`)
  },

  async createScanInfo(data: CreateScanInfoData): Promise<ApiResponse<ScanInfo>> {
    return apiClient.post<ScanInfo>('/api/scan-infos', data)
  },

  async updateScanInfo(id: number, data: UpdateScanInfoData): Promise<ApiResponse<ScanInfo>> {
    return apiClient.put<ScanInfo>(`/api/scan-infos/${id}`, data)
  },

  async deleteScanInfo(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/scan-infos/${id}`)
  },

  async generateQRCode(id: number): Promise<ApiResponse<{ qr_code_base64: string } | { qr_code_data: string } | string>> {
    return apiClient.get<{ qr_code_base64: string } | { qr_code_data: string } | string>(`/api/scan-infos/${id}/qr-code`)
  },
}

// Complaint Report API interface
export interface ComplaintReport {
  id: number
  type: 'complaint' | 'report'
  title: string
  description: string
  reporter_id: string
  tenant_id?: string | null
  status: string | number // 'pending' | 'in_progress' | 'resolved' | 'closed' or 0-3
  priority: string | number // 'low' | 'medium' | 'high' | 'urgent' or 0-3
  created_by?: string | null
  updated_by?: string | null
  created_at?: string
  updated_at?: string
  reporter?: User
  tenant?: Tenant
  createdBy?: User
  updatedBy?: User
  evidences?: Array<{ url: string } | string> // Array of evidence objects with url property or string URLs
}

export interface CreateComplaintReportData {
  type: 'complaint' | 'report'
  title: string
  description: string
  reporter_id: string
  tenant_id?: string | null
  status?: number // 0=pending, 1=in_progress, 2=resolved, 3=closed
  priority?: number // 0=low, 1=medium, 2=high, 3=urgent
  evidences?: string[] // Array of URLs
}

export interface UpdateComplaintReportData {
  type?: 'complaint' | 'report'
  title?: string
  description?: string
  reporter_id?: string
  tenant_id?: string | null
  status?: number | string // 0=pending, 1=in_progress, 2=resolved, 3=closed or 'pending'|'in_progress'|'resolved'|'closed'
  priority?: number | string // 0=low, 1=medium, 2=high, 3=urgent or 'low'|'medium'|'high'|'urgent'
  notes?: string // Notes for the log entry
  photo_evidence?: File | string // Photo evidence file or URL
}

// Complaint Report Log interface
export interface ComplaintReportLog {
  id: number
  complaint_report_id: number
  old_status?: string | null
  new_status?: string | null
  notes?: string | null
  photo_evidence_url?: string | null
  created_by?: string | null
  created_at?: string
  createdBy?: User
}

// Complaint Report-specific API functions
export const complaintReportsApi = {
  async getComplaintReports(params?: {
    title?: string
    type?: 'complaint' | 'report'
    status?: string | number
    priority?: string | number
    tenant_id?: string
    reporter_id?: string
    order?: string
    limit?: number
    offset?: number
  }): Promise<ApiResponse<ComplaintReport[]>> {
    const queryParams = new URLSearchParams()
    if (params?.title) queryParams.append('title', params.title)
    if (params?.type) queryParams.append('type', params.type)
    if (params?.status !== undefined && params?.status !== null) queryParams.append('status', String(params.status))
    if (params?.priority !== undefined && params?.priority !== null) queryParams.append('priority', String(params.priority))
    if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id)
    if (params?.reporter_id) queryParams.append('reporter_id', params.reporter_id)
    if (params?.order) queryParams.append('order', params.order)
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    
    const endpoint = `/api/complaint-reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<ComplaintReport[]>(endpoint)
  },

  async getComplaintReport(id: number): Promise<ApiResponse<ComplaintReport>> {
    return apiClient.get<ComplaintReport>(`/api/complaint-reports/${id}`)
  },

  async createComplaintReport(data: CreateComplaintReportData): Promise<ApiResponse<ComplaintReport>> {
    return apiClient.post<ComplaintReport>('/api/complaint-reports', data)
  },

  async uploadComplaintReportFile(file: File): Promise<ApiResponse<{url: string, filename: string}>> {
    const formData = new FormData()
    formData.append('file', file)
    
    return apiClient.post<{url: string, filename: string}>('/api/uploads/complaint-reports', formData)
  },

  async updateComplaintReport(id: number, data: UpdateComplaintReportData): Promise<ApiResponse<ComplaintReport>> {
    return apiClient.put<ComplaintReport>(`/api/complaint-reports/${id}`, data)
  },

  async deleteComplaintReport(id: number): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/api/complaint-reports/${id}`)
  },

  async getComplaintReportLogs(id: number): Promise<ApiResponse<ComplaintReportLog[]>> {
    return apiClient.get<ComplaintReportLog[]>(`/api/complaint-reports/${id}/logs`)
  },
}

// User Task API interface
export interface UserTask {
  id?: number
  user_task_id?: number | string
  user_id: string
  task_id: number | string
  status: 'pending' | 'inprogress' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at?: string
  started_at?: string
  start_at?: string | null
  completed_at?: string | null
  notes?: string | null
  code?: string
  time?: string
  is_main_task?: boolean
  parent_user_task_id?: number | string | null
  created_at: string
  updated_at?: string | null
  task?: Task
  user?: User
  evidences?: any[]
  sub_user_task?: UserTask[]
}

export interface CreateUserTaskData {
  user_id: string
  task_id: number
  scheduled_at: string
  notes?: string
}

export interface UpdateUserTaskData {
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
}

// User Tasks-specific API functions
export const userTasksApi = {
  async getUserTasks(params?: {
    limit?: number
    offset?: number
    user_id?: string
    date_from?: string
    date_to?: string
  }): Promise<ApiResponse<UserTask[]>> {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.user_id) queryParams.append('user_id', params.user_id)
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    if (params?.date_from) queryParams.append('date_from', params.date_from)
    if (params?.date_to) queryParams.append('date_to', params.date_to)
    
    const endpoint = `/api/user-tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return apiClient.get<UserTask[]>(endpoint)
  },

  async getUpcomingUserTasks(): Promise<ApiResponse<UserTask[]>> {
    return apiClient.get<UserTask[]>('/api/user-tasks/upcoming')
  },

  async generateUpcomingUserTasks(): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/api/user-tasks/generate-upcoming')
  },

  async startUserTask(id: number): Promise<ApiResponse<UserTask>> {
    return apiClient.put<UserTask>(`/api/user-tasks/${id}/start`)
  },

  async completeUserTask(id: number, data?: { notes?: string }): Promise<ApiResponse<UserTask>> {
    return apiClient.put<UserTask>(`/api/user-tasks/${id}/complete`, data)
  },

  async completeUserTaskWithFiles(id: number, formData: FormData): Promise<ApiResponse<UserTask>> {
    return apiClient.putFormData<UserTask>(`/api/user-tasks/${id}/complete`, formData)
  },
}

// Dashboard API interfaces
export interface DashboardComplaint {
  id: number
  unit: string
  reporter: string
  date: string
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'
}

export interface DashboardComplaintStats {
  total: number
  pending: number
  in_progress: number
  resolved: number
  closed: number
}

export interface DashboardExpiringTenant {
  id: string
  name: string
  unit: string
  monthsRemaining: number
  daysRemaining: number
  contractEndAt: string
}

export interface DashboardWorker {
  id: string
  name: string
  email: string
  role: string
  attendance: number
  taskCompletion: number
}

export interface DashboardDailyTaskCompletion {
  day: string
  date: string
  keamanan: {
    completion: number
    total: number
    completed: number
  }
  kebersihan: {
    completion: number
    total: number
    completed: number
  }
}

export interface DashboardMonthlyTaskCompletion {
  month: string
  monthStart: string
  monthEnd: string
  keamanan: {
    completion: number
    total: number
    completed: number
  }
  kebersihan: {
    completion: number
    total: number
    completed: number
  }
}

export interface DashboardData {
  complaints: {
    recent: DashboardComplaint[]
    stats: DashboardComplaintStats
  }
  expiringTenants: DashboardExpiringTenant[]
  workers: DashboardWorker[]
  dailyTaskCompletion: DashboardDailyTaskCompletion[]
  monthlyTaskCompletion: DashboardMonthlyTaskCompletion[]
}

export interface DashboardStats {
  totalRevenue: {
    value: number
    formatted: string
    change: string
    changeType: 'positive' | 'negative'
  }
  totalAssets: {
    value: number
    formatted: string
    change: string
    changeType: 'positive' | 'negative'
  }
  totalUnits: {
    value: number
    formatted: string
    change: string
    changeType: 'positive' | 'negative'
  }
  totalTenants: {
    value: number
    formatted: string
    change: string
    changeType: 'positive' | 'negative'
  }
}

export interface TopAssetRevenue {
  name: string
  revenue: number
  formatted: string
}

export interface RevenueGrowth {
  years: string[]
  revenue: number[]
}

// Dashboard API functions
export const dashboardApi = {
  async getDashboardData(): Promise<ApiResponse<DashboardData>> {
    return apiClient.get<DashboardData>('/api/dashboard')
  },
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return apiClient.get<DashboardStats>('/api/dashboard/stats')
  },
  async getTopAssetRevenue(): Promise<ApiResponse<TopAssetRevenue[]>> {
    return apiClient.get<TopAssetRevenue[]>('/api/dashboard/top-asset-revenue')
  },
  async getRevenueGrowth(): Promise<ApiResponse<RevenueGrowth>> {
    return apiClient.get<RevenueGrowth>('/api/dashboard/revenue-growth')
  },
}

// Settings interfaces
export interface Setting {
  id: number
  key: string
  value: string
  description?: string
  created_by?: string
  updated_by?: string
  created_at: string
  updated_at: string
}

// Settings API functions
export const settingsApi = {
  async getSettings(): Promise<ApiResponse<Setting[]>> {
    return apiClient.get<Setting[]>('/api/settings')
  },
  async getSettingById(id: number): Promise<ApiResponse<Setting>> {
    return apiClient.get<Setting>(`/api/settings/${id}`)
  },
  async getSettingByKey(key: string): Promise<ApiResponse<Setting>> {
    return apiClient.get<Setting>(`/api/settings?key=${encodeURIComponent(key)}`)
  },
  async createSetting(data: { key: string; value: string; description?: string }): Promise<ApiResponse<Setting>> {
    return apiClient.post<Setting>('/api/settings', data)
  },
  async updateSetting(id: number, data: { value: string; description?: string }): Promise<ApiResponse<Setting>> {
    return apiClient.put<Setting>(`/api/settings/${id}`, data)
  },
  async updateSettingByKey(key: string, data: { value: string; description?: string }): Promise<ApiResponse<Setting>> {
    return apiClient.put<Setting>(`/api/settings/${key}`, data)
  },
  async deleteSetting(id: number): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`/api/settings/${id}`)
  },
}

// Predefined menu structure for access control
export const MENU_STRUCTURE: MenuAccess[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    icon: 'House',
    hasAccess: false
  },
  {
    id: 'users',
    name: 'Users',
    path: '/users',
    icon: 'UsersRound',
    hasAccess: false,
    children: [
      {
        id: 'users-manage',
        name: 'Manage Users',
        path: '/users',
        hasAccess: false
      },
      {
        id: 'users-role',
        name: 'Manage Role',
        path: '/role',
        hasAccess: false
      }
    ]
  },
  {
    id: 'asset',
    name: 'Asset',
    path: '/asset',
    icon: 'Boxes',
    hasAccess: false
  },
  {
    id: 'unit',
    name: 'Unit',
    path: '/unit',
    icon: 'Building2',
    hasAccess: false
  },
  {
    id: 'worker',
    name: 'Worker',
    path: '/worker',
    icon: 'UsersRound',
    hasAccess: false
  },
  {
    id: 'tenants',
    name: 'Tenants',
    path: '/tenants',
    icon: 'Building2',
    hasAccess: false
  },
  {
    id: 'task',
    name: 'Task',
    path: '/task',
    icon: 'StickyNote',
    hasAccess: false
  },
  {
    id: 'setting',
    name: 'Setting',
    path: '#',
    icon: 'Settings',
    hasAccess: false,
    children: [
      {
        id: 'setting-company',
        name: 'Company',
        path: '/company',
        hasAccess: false
      },
      {
        id: 'setting-payment',
        name: 'Payment Method',
        path: '/payment-method',
        hasAccess: false
      },
      {
        id: 'setting-notification',
        name: 'Notification',
        path: '/settings-notification',
        hasAccess: false
      },
      {
        id: 'setting-alert',
        name: 'Notification Alert',
        path: '/notification-alert',
        hasAccess: false
      },
      {
        id: 'setting-options',
        name: 'Setting Options',
        path: '/setting-options',
        hasAccess: false
      }
    ]
  }
]