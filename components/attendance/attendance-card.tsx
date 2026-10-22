'use client'

import { assetsApi, attendanceApi, settingsApi, authApi, usersApi, Attendance, User } from "@/lib/api";
import React, { useEffect, useState } from "react";
import { MapPin, AtSign, CheckCircle2, LogIn, LogOut, Clock, RefreshCw } from "lucide-react";

interface TodayAttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  status: string;
  attendance: any;
}

export default function AttendanceCard() {
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [assets, setAssets] = useState<{id: string, name: string, lat: number, lng: number}[]>([]);
  const [isNearAsset, setIsNearAsset] = useState(false);
  const [nearestAsset, setNearestAsset] = useState<{id: string, name: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceStatus, setAttendanceStatus] = useState<null | "success" | "error">(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastAttendance, setLastAttendance] = useState<string | null>(null);
  const [todayAttendanceStatus, setTodayAttendanceStatus] = useState<TodayAttendanceStatus | null>(null);
  const [radiusDistance, setRadiusDistance] = useState<number>(5); // Default 20000 meters
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await authApi.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  // Load attendance history (last 10 days)
  useEffect(() => {
    const loadAttendanceHistory = async () => {
      try {
        const response = await attendanceApi.getUserAttendanceHistory(10);
        if (response.success && response.data) {
          const responseData = response.data as any;
          const history = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : []);
          setAttendanceHistory(history);
        }
      } catch (error) {
        console.error('Error loading attendance history:', error);
      }
    };
    if (currentUser?.id) {
      loadAttendanceHistory();
    }
  }, [currentUser?.id, refreshKey]);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedAttendance = localStorage.getItem('lastAttendance');
    if (savedAttendance) {
      setLastAttendance(savedAttendance);
    }
  }, []);

  // Load radius distance setting from table settings with key "attendance_radius_distance"
  useEffect(() => {
    const loadRadiusDistance = async () => {
      try {
        const response = await settingsApi.getSettingByKey('attendance_radius_distance');
        if (response.success && response.data) {
          // Handle different response structures
          const settingData = response.data as any;
          // Get value from setting object - could be direct or nested
          const settingValue = settingData.value || (settingData.data && settingData.data.value);
          
          if (settingValue) {
            const value = parseFloat(settingValue);
            if (!isNaN(value) && value > 0) {
              console.log('Loaded attendance radius distance from settings:', value);
              setRadiusDistance(value);
            } else {
              console.warn('Invalid radius distance value from settings:', settingValue);
            }
          } else {
            console.warn('No value found in attendance radius distance setting');
          }
        } else {
          console.warn('Failed to load attendance radius distance setting:', response.error || response.message);
        }
      } catch (error) {
        console.error('Error loading attendance radius distance:', error);
        // Keep default value (20000 meters) on error
      }
    };
    loadRadiusDistance();
  }, []);

  // Check today's attendance status
  const checkTodayStatus = async (assetId: string | number) => {
    // Validate assetId before proceeding - can be UUID (string) or number
    if (!assetId || assetId === null || assetId === undefined) {
      console.error('Invalid asset ID:', assetId);
      const defaultStatus: TodayAttendanceStatus = {
        hasCheckedIn: false,
        hasCheckedOut: false,
        status: 'not_checked_in',
        attendance: null
      };
      setTodayAttendanceStatus(defaultStatus);
      return;
    }

    console.log('Checking today status for asset ID:', assetId);
    try {
      const response = await attendanceApi.getTodayStatus(assetId);
      console.log('Today status response:', response);
      
      if (response.success) {
        if (response.data) {
          const statusData = response.data;
          
          // Handle backend response structure - backend returns hasCheckedIn/hasCheckedOut
          if (statusData.hasCheckedIn !== undefined || statusData.hasCheckedOut !== undefined) {
            // Backend returns wrapped structure
            const statusDataMapped: TodayAttendanceStatus = {
              hasCheckedIn: statusData.hasCheckedIn || false,
              hasCheckedOut: statusData.hasCheckedOut || false,
              status: statusData.status || 'not_checked_in',
              attendance: statusData.attendance || null
            };
            setTodayAttendanceStatus(statusDataMapped);
            console.log('Today attendance status set:', statusDataMapped);
          } else if (statusData.check_in_time || statusData.check_out_time) {
            // Direct attendance object structure (fallback)
            const statusDataMapped: TodayAttendanceStatus = {
              hasCheckedIn: !!statusData.check_in_time,
              hasCheckedOut: !!statusData.check_out_time,
              status: statusData.status || (statusData.check_out_time ? 'checked_out' : 'checked_in'),
              attendance: statusData
            };
            setTodayAttendanceStatus(statusDataMapped);
            console.log('Today attendance status set (direct):', statusDataMapped);
          } else {
            // No attendance data
            console.log('No attendance data for today, setting default status');
            const defaultStatus: TodayAttendanceStatus = {
              hasCheckedIn: false,
              hasCheckedOut: false,
              status: 'not_checked_in',
              attendance: null
            };
            setTodayAttendanceStatus(defaultStatus);
          }
        } else {
          // No data in response
          console.log('No attendance data for today, setting default status');
          const defaultStatus: TodayAttendanceStatus = {
            hasCheckedIn: false,
            hasCheckedOut: false,
            status: 'not_checked_in',
            attendance: null
          };
          setTodayAttendanceStatus(defaultStatus);
        }
      } else {
        console.log('API returned unsuccessful response:', response.error || response.message);
        // Set default status if API call failed
        const defaultStatus: TodayAttendanceStatus = {
          hasCheckedIn: false,
          hasCheckedOut: false,
          status: 'not_checked_in',
          attendance: null
        };
        setTodayAttendanceStatus(defaultStatus);
      }
    } catch (error) {
      console.error('Error checking today status:', error);
      // Set default status on error
      const defaultStatus: TodayAttendanceStatus = {
        hasCheckedIn: false,
        hasCheckedOut: false,
        status: 'not_checked_in',
        attendance: null
      };
      setTodayAttendanceStatus(defaultStatus);
    }
  };

  // Helper: Format date with day
  const formatDateWithDay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Helper: Format date short
  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Helper: Format time
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper: hitung jarak dua titik latlong (meter)
  function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  useEffect(() => {
    // 1. Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log('User location detected:', { lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      console.log('Geolocation not supported');
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    // 2. Fetch user assets from user_assets table
    async function fetchAssets() {
      try {
        // Use currentUser from state instead of fetching again
        if (!currentUser || !currentUser.id) {
          console.error('User tidak ditemukan');
          setLoading(false);
          return;
        }

        // Get user assets from user_assets table
        const response = await usersApi.getUserAssets(currentUser.id);
        
        if (response.success && response.data) {
          const responseData = response.data as any;
          // Handle different response structures
          const userAssetsData = Array.isArray(responseData.data) 
            ? responseData.data 
            : (Array.isArray(responseData) ? responseData : []);
          
          console.log('User assets data:', userAssetsData);
          
          // Map user assets to format expected by attendance card
          // Extract asset data from user_assets (asset object contains full asset data)
          const mappedAssets = userAssetsData
            .filter((ua: any) => {
              // Filter only assets that have valid coordinates
              // Asset data is in ua.asset object
              const asset = ua.asset;
              return asset && asset.latitude && asset.longitude;
            })
            .map((ua: any) => {
              // Use asset object which contains full asset data including coordinates
              const asset = ua.asset;
              return {
                id: asset.id || ua.asset_id,
                name: asset.name || ua.asset_name || 'Unknown Asset',
                lat: asset.latitude,
                lng: asset.longitude,
              };
            });
          
          console.log('Mapped assets for attendance:', mappedAssets);
          setAssets(mappedAssets);
        } else {
          console.error('Gagal memuat data user assets:', response.error || response.message);
          setAssets([]);
        }
      } catch (error) {
        console.error('Error fetching user assets:', error);
        setAssets([]);
      }
    }
    if (currentUser?.id) {
      fetchAssets();
    }
  }, [refreshKey, currentUser?.id]);

  useEffect(() => {
    // 3. Cek apakah user dekat dengan salah satu asset
    if (location && assets.length > 0) {
      console.log('Checking distance for location:', location);
      console.log('Available assets:', assets);
      console.log('Radius distance allowed:', radiusDistance);
      
      let nearest = null;
      let nearestDistance = Infinity;
      
      // Find the nearest asset (regardless of radius)
      for (const asset of assets) {
        // Check different possible field names for coordinates
        const assetLat = asset.lat || (asset as any).latitude || (asset as any).latitude_coordinate;
        const assetLng = asset.lng || (asset as any).longitude || (asset as any).longitude_coordinate;
        
        if (!assetLat || !assetLng) {
          console.log('Asset missing coordinates:', asset);
          continue;
        }
        
        const dist = getDistanceFromLatLonInMeters(location.lat, location.lng, assetLat, assetLng);
        console.log(`Distance to ${asset.name}:`, dist, 'meters');
        
        // Find the nearest asset
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearest = asset;
        }
      }
      
      // Set current distance to nearest asset
      if (nearest && nearestDistance !== Infinity) {
        setCurrentDistance(nearestDistance);
        console.log('Nearest asset:', nearest.name, 'Distance:', nearestDistance, 'meters');
        
        // Check if within radius
        const withinRadius = nearestDistance <= radiusDistance;
        setIsNearAsset(withinRadius);
        console.log('Within radius:', withinRadius, `(${nearestDistance} <= ${radiusDistance})`);
        
        // Set nearest asset regardless of radius (so we can show info)
        if (nearest.id) {
          const assetId = nearest.id;
          if (assetId !== null && assetId !== undefined && assetId !== '') {
            setNearestAsset({id: String(assetId), name: nearest.name});
            
            // Only check today status if within radius
            if (withinRadius) {
              console.log('Checking today status for asset ID:', assetId);
              checkTodayStatus(assetId);
            }
          } else {
            console.error('Invalid asset ID:', nearest.id);
            setNearestAsset(null);
          }
        } else {
          setNearestAsset(null);
        }
      } else {
        console.log('No nearest asset found');
        setNearestAsset(null);
        setCurrentDistance(null);
        setIsNearAsset(false);
      }
    } else if (location && assets.length === 0) {
      console.log('No assets available');
      setNearestAsset(null);
      setCurrentDistance(null);
      setIsNearAsset(false);
    }
    
    // Set loading to false when we have location or when we've checked all assets
    if (location !== null) {
      setLoading(false);
    }
  }, [location, assets, radiusDistance]);

  const handleAbsensi = async () => {
    if (!nearestAsset || !location) return;
    
    // Validate assetId before proceeding - can be UUID (string) or number
    const assetId = nearestAsset.id; // Keep as-is (UUID string or number)
    
    if (!assetId || assetId === null || assetId === undefined || assetId === '') {
      setAttendanceStatus("error");
      return;
    }
    
    setAttendanceStatus(null);
    
    try {
      // Check if already checked in today
      if (todayAttendanceStatus?.hasCheckedIn && !todayAttendanceStatus?.hasCheckedOut) {
        // Check out
        const response = await attendanceApi.checkOut(
          assetId,
          location.lat,
          location.lng
        );
        
        if (response.success) {
          setAttendanceStatus("success");
          console.log('Check-out successful:', response.data);
        } else {
          setAttendanceStatus("error");
          const errorMsg = response.error || response.message || 'Check-out gagal';
          console.error('Check-out failed:', errorMsg);
        }
      } else {
        // Check in
        const response = await attendanceApi.checkIn(
          assetId,
          location.lat,
          location.lng
        );
        
        if (response.success) {
          setAttendanceStatus("success");
          console.log('Check-in successful:', response.data);
        } else {
          setAttendanceStatus("error");
          const errorMsg = response.error || response.message || 'Check-in gagal';
          console.error('Check-in failed:', errorMsg);
        }
      }
      
      // Save to localStorage
      const attendanceData = {
        timestamp: new Date().toISOString(),
        assetId: String(assetId),
        assetName: nearestAsset.name,
        location: location
      };
      localStorage.setItem('lastAttendance', JSON.stringify(attendanceData));
      setLastAttendance(JSON.stringify(attendanceData));
      
      // Refresh today status and attendance history after a short delay to ensure database is updated
      setTimeout(async () => {
        await checkTodayStatus(assetId);
        // Reload attendance history
        try {
          const historyResponse = await attendanceApi.getUserAttendanceHistory(10);
          if (historyResponse.success && historyResponse.data) {
            const responseData = historyResponse.data as any;
            const history = Array.isArray(responseData.data) 
              ? responseData.data 
              : (Array.isArray(responseData) ? responseData : []);
            setAttendanceHistory(history);
          }
        } catch (error) {
          console.error('Error reloading attendance history:', error);
        }
      }, 500);
      
      // Auto reset after 3 seconds
      setTimeout(() => {
        setAttendanceStatus(null);
        setRefreshKey(prev => prev + 1);
      }, 3000);
    } catch (error) {
      console.error('Attendance error:', error);
      setAttendanceStatus("error");
    }
  };

  const handleRefresh = () => {
    console.log('Refreshing attendance card...');
    setLoading(true);
    setAttendanceStatus(null);
    setIsNearAsset(false);
    setNearestAsset(null);
    setLocation(null);
    setCurrentDistance(null);
    setRefreshKey(prev => prev + 1);
    
    // Reload location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log('User location refreshed:', { lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (error) => {
          console.error('Geolocation error on refresh:', error);
          setLoading(false);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Format employee ID (e.g., ID400099)
  const formatEmployeeId = (userId: string | undefined) => {
    if (!userId) return 'ID-';
    // Extract last 6 characters and pad with zeros if needed
    const idPart = userId.length > 6 ? userId.slice(-6) : userId.padStart(6, '0');
    // Convert to numeric format if possible
    const numericPart = idPart.replace(/\D/g, '');
    if (numericPart.length > 0) {
      return `ID${numericPart.padStart(6, '0')}`;
    }
    return `ID${idPart}`;
  };

  // Group attendance history by date
  const groupAttendanceByDate = (history: Attendance[]) => {
    const grouped: { [key: string]: Attendance[] } = {};
    history.forEach((attendance) => {
      const date = new Date(attendance.check_in_time).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(attendance);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow flex items-center justify-center min-h-[120px]">
        <span className="text-muted-foreground">Mendeteksi lokasi...</span>
      </div>
    );
  }

  const groupedHistory = groupAttendanceByDate(attendanceHistory);
  const isInsideRadius = isNearAsset && currentDistance !== null && currentDistance <= radiusDistance;

  return (
    <div className="space-y-4">
      {/* Attendance Status Card */}
      {nearestAsset ? (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4 mb-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-gray-600 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-gray-500 mb-1">Nearest Location</div>
            <div className="text-sm font-semibold text-gray-900">{nearestAsset.name}</div>
          </div>
        </div>
        
         <div className="flex items-start gap-3">
           <AtSign className="h-5 w-5 text-gray-600 mt-0.5" />
           <div className="flex-1">
             <div className="flex items-center justify-between mb-1">
               <div className="text-xs text-gray-500">Attendance Radius</div>
               <button
                 onClick={handleRefresh}
                 disabled={loading}
                 className="p-1.5 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                 title="Refresh jarak"
               >
                 <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
               </button>
             </div>
             <div className="text-sm font-semibold text-gray-900">
               {currentDistance !== null 
                 ? (currentDistance < 1000 
                     ? `${Math.round(currentDistance)} meters` 
                     : `${(currentDistance / 1000).toFixed(1)} km`)
                 : (radiusDistance < 1000 
                     ? `${Math.round(radiusDistance)} meters` 
                     : `${(radiusDistance / 1000).toFixed(1)} km`)
               }
             </div>
           </div>
         </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <span className="text-sm text-gray-700">Radius Status</span>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
            isInsideRadius 
              ? 'bg-green-500 text-white' 
              : 'bg-red-100 text-red-700'
          }`}>
            <CheckCircle2 className={`h-4 w-4 ${isInsideRadius ? 'text-white' : 'text-red-700'}`} />
            <span className="text-xs font-medium">
              {isInsideRadius ? 'Inside Radius' : 'Outside Radius'}
            </span>
          </div>
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
        <div className="text-center text-gray-600 py-4">
          <p className="text-sm">Mendeteksi lokasi terdekat...</p>
        </div>
      </div>
    )}

    {/* Warning message when outside radius */}
    {nearestAsset && !isInsideRadius && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-800 mb-1">Anda tidak berada pada radius absensi</h4>
            <p className="text-xs text-red-700">
              Anda berada di luar radius yang diizinkan untuk melakukan absensi. 
              {currentDistance !== null && (
                <span> Jarak Anda saat ini: {currentDistance < 1000 
                  ? `${Math.round(currentDistance)} meters` 
                  : `${(currentDistance / 1000).toFixed(1)} km`} dari {nearestAsset.name}. 
                  Radius yang diizinkan: {radiusDistance < 1000 
                    ? `${Math.round(radiusDistance)} meters` 
                    : `${(radiusDistance / 1000).toFixed(1)} km`}.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    )}

    {/* Action Buttons */}
    {nearestAsset && isInsideRadius && (
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleAbsensi}
          disabled={
            attendanceStatus === "success" || 
            (todayAttendanceStatus?.hasCheckedIn && !todayAttendanceStatus?.hasCheckedOut)
          }
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            attendanceStatus === "success" || 
            (todayAttendanceStatus?.hasCheckedIn && !todayAttendanceStatus?.hasCheckedOut)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
          }`}
        >
          <LogIn className="h-5 w-5" />
          <span>Check In</span>
        </button>
        
        <button
          onClick={handleAbsensi}
          disabled={
            attendanceStatus === "success" || 
            !todayAttendanceStatus?.hasCheckedIn ||
            todayAttendanceStatus?.hasCheckedOut
          }
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            attendanceStatus === "success" || 
            !todayAttendanceStatus?.hasCheckedIn ||
            todayAttendanceStatus?.hasCheckedOut
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 text-white shadow-md'
          }`}
        >
          <LogOut className="h-5 w-5" />
          <span>Check Out</span>
        </button>
      </div>
    )}

    {/* Success/Error Messages */}
    {attendanceStatus === "success" && (
      <div className="mt-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium">
            {todayAttendanceStatus?.hasCheckedIn && !todayAttendanceStatus?.hasCheckedOut
              ? 'Check-out berhasil!'
              : 'Check-in berhasil!'
            }
          </span>
        </div>
      </div>
    )}
    {attendanceStatus === "error" && (
      <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-red-600" />
          <span className="text-sm font-medium">Gagal absen. Coba lagi.</span>
        </div>
      </div>
      )}
    </div>
  );
}
