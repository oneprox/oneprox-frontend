'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Camera } from 'lucide-react'
import { UserTask, userTasksApi, settingsApi } from '@/lib/api'
import toast from 'react-hot-toast'

interface CompleteTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userTask: UserTask | null
  onComplete: () => void
}

export function CompleteTaskDialog({
  open,
  onOpenChange,
  userTask,
  onComplete
}: CompleteTaskDialogProps) {
  const [formData, setFormData] = useState({
    remark: '',
    fileBefore: null as File | null,
    fileAfter: null as File | null,
    fileScan: null as File | null,
    scanCode: ''
  })
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false)
  const [filePreview, setFilePreview] = useState<{
    before?: string
    after?: string
    scan?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrLocation, setQrLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [isLocationValid, setIsLocationValid] = useState<boolean | null>(null)
  const [isCheckingLocation, setIsCheckingLocation] = useState(false)
  const [isScanCodeValid, setIsScanCodeValid] = useState<boolean | null>(null)
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [radiusDistance, setRadiusDistance] = useState<number>(5) // Default 20000 meters

  const task = userTask?.task
  const userRoleName = userTask?.user?.role?.name?.toLowerCase()

  // Load radius distance setting on mount
  useEffect(() => {
    const loadRadiusDistance = async () => {
      try {
        const response = await settingsApi.getSettingByKey('task_radius_distance')
        if (response.success && response.data) {
          // Handle different response structures
          const settingData = response.data as any
          // Get value from setting object - could be direct or nested
          const settingValue = settingData.value || (settingData.data && settingData.data.value)
          
          if (settingValue) {
            const value = parseFloat(settingValue)
            if (!isNaN(value) && value > 0) {
              console.log('Loaded task radius distance from settings:', value)
              setRadiusDistance(value)
            } else {
              console.warn('Invalid task radius distance value from settings:', settingValue)
            }
          } else {
            console.warn('No value found in task radius distance setting')
          }
        } else {
          console.warn('Failed to load task radius distance setting:', response.error || response.message)
        }
      } catch (error) {
        console.error('Error loading task radius distance:', error)
        // Keep default value (20000 meters) on error
      }
    }
    loadRadiusDistance()
  }, [])

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    // Validate inputs
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      console.error('[DISTANCE] Invalid coordinates:', { lat1, lon1, lat2, lon2 })
      return Infinity
    }

    // Validate latitude range (-90 to 90)
    if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
      console.error('[DISTANCE] Invalid latitude range:', { lat1, lat2 })
      return Infinity
    }

    // Validate longitude range (-180 to 180)
    if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
      console.error('[DISTANCE] Invalid longitude range:', { lon1, lon2 })
      return Infinity
    }

    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const distance = R * c // Distance in meters
    
    // Round to 2 decimal places for accuracy
    return Math.round(distance * 100) / 100
  }

  // Check if user is near the QR code location
  const checkLocation = async (qrLat: number, qrLon: number): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation tidak didukung oleh browser'))
        return
      }

      setIsCheckingLocation(true)
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude
          const userLon = position.coords.longitude
          const accuracy = position.coords.accuracy // Accuracy in meters
          
          console.log('[LOCATION] User location:', { 
            latitude: userLat, 
            longitude: userLon,
            accuracy: accuracy ? `${accuracy.toFixed(2)}m` : 'unknown'
          })
          console.log('[LOCATION] QR location:', { latitude: qrLat, longitude: qrLon })
          
          const distance = calculateDistance(userLat, userLon, qrLat, qrLon)
          console.log('[LOCATION] Calculated distance:', distance, 'meters')
          console.log('[LOCATION] Max allowed distance (radius):', radiusDistance, 'meters')
          
          // Validate distance calculation
          if (distance === Infinity || isNaN(distance)) {
            console.error('[LOCATION] ❌ Invalid distance calculation')
            setIsLocationValid(false)
            setIsCheckingLocation(false)
            toast.error('Gagal menghitung jarak. Pastikan koordinat QR code valid.')
            reject(new Error('Invalid distance calculation'))
            return
          }
          
          // Use radius distance from settings
          const maxDistance = radiusDistance
          const isValid = distance <= maxDistance
          
          console.log('[LOCATION] Validation result:', {
            distance: `${distance.toFixed(2)}m`,
            maxDistance: `${maxDistance}m`,
            isValid: isValid ? '✅ VALID' : '❌ INVALID',
            difference: `${Math.abs(distance - maxDistance).toFixed(2)}m`
          })
          
          setIsLocationValid(isValid)
          setIsCheckingLocation(false)
          
          if (isValid) {
            console.log('[LOCATION] ✅ User is within range')
            toast.success(`Lokasi valid! Jarak: ${Math.round(distance)}m (maks: ${maxDistance}m)`)
          } else {
            console.log('[LOCATION] ❌ User is too far away')
            const distanceDiff = distance - maxDistance
            toast.error(`Anda terlalu jauh dari lokasi QR code. Jarak: ${Math.round(distance)}m (maks: ${maxDistance}m, selisih: ${Math.round(distanceDiff)}m)`)
          }
          
          resolve(isValid)
        },
        (error) => {
          setIsCheckingLocation(false)
          console.error('[LOCATION] Error getting location:', error)
          
          let errorMsg = 'Gagal mendapatkan lokasi'
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMsg = 'Izin lokasi ditolak. Silakan berikan izin lokasi di pengaturan browser.'
              break
            case error.POSITION_UNAVAILABLE:
              errorMsg = 'Informasi lokasi tidak tersedia. Pastikan GPS aktif dan koneksi internet stabil.'
              break
            case error.TIMEOUT:
              errorMsg = 'Request lokasi timeout. Pastikan GPS aktif dan coba lagi.'
              break
          }
          
          toast.error(errorMsg)
          setIsLocationValid(false)
          reject(new Error(errorMsg))
        },
        {
          enableHighAccuracy: true, // Use GPS if available for better accuracy
          timeout: 15000, // Increased timeout to 15 seconds
          maximumAge: 0 // Always get fresh location, don't use cached
        }
      )
    })
  }

  const handleFileChange = (field: 'fileBefore' | 'fileAfter' | 'fileScan', file: File | null) => {
    if (file) {
      // For keamanan role with need_validation: only allow after attachment
      if (task?.is_need_validation && (userRoleName?.toLowerCase() === 'keamanan' || userRoleName?.toLowerCase() === 'security')) {
        if (field === 'fileBefore') {
          toast.error('Untuk role keamanan, hanya boleh mengupload foto After')
          return
        }
        // Clear fileBefore if it exists when uploading after
        if (field === 'fileAfter') {
          setFormData(prev => ({
            ...prev,
            fileBefore: null,
            fileAfter: file
          }))
          setFilePreview(prev => {
            const newPreview = { ...prev }
            delete newPreview.before
            return newPreview
          })
        } else {
          setFormData(prev => ({ ...prev, [field]: file }))
        }
      } else {
        setFormData(prev => ({ ...prev, [field]: file }))
      }
      
      // Read and set preview for the new file
      const reader = new FileReader()
      reader.onload = (e) => {
        const previewKey = field === 'fileBefore' ? 'before' : field === 'fileAfter' ? 'after' : 'scan'
        setFilePreview(prev => ({ ...prev, [previewKey]: e.target?.result as string }))
      }
      reader.readAsDataURL(file)
    } else {
      setFormData(prev => {
        const newData = { ...prev }
        newData[field] = null
        return newData
      })
      setFilePreview(prev => {
        const newPreview = { ...prev }
        const previewKey = field === 'fileBefore' ? 'before' : field === 'fileAfter' ? 'after' : 'scan'
        delete newPreview[previewKey as keyof typeof newPreview]
        return newPreview
      })
    }
  }

  const captureFromCamera = async (field: 'fileBefore' | 'fileAfter' | 'fileScan') => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Browser tidak mendukung akses kamera. Pastikan menggunakan browser modern dan HTTPS.')
        return
      }

      // Check if we're on HTTPS or localhost (required for camera access)
      const isSecure = window.location.protocol === 'https:' || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1'
      
      if (!isSecure) {
        toast.error('Akses kamera memerlukan koneksi HTTPS. Silakan gunakan HTTPS atau localhost.')
        return
      }

      // Mark camera modal as open
      setIsCameraModalOpen(true)

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Prefer back camera on mobile
      })
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Create modal overlay with very high z-index and pointer-events
        const modal = document.createElement('div')
        modal.id = 'camera-modal-overlay'
        modal.style.cssText = 'position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; pointer-events: auto;'
        
        // Create modal content
        const modalContent = document.createElement('div')
        modalContent.id = 'camera-modal-content'
        modalContent.style.cssText = 'background-color: white; padding: 1rem; border-radius: 0.5rem; max-width: 28rem; width: 100%; margin: 1rem; position: relative; z-index: 10001; pointer-events: auto;'
        
        // Create video element
        const previewVideo = document.createElement('video')
        previewVideo.id = 'camera-preview'
        previewVideo.setAttribute('autoplay', '')
        previewVideo.setAttribute('playsinline', '')
        previewVideo.style.cssText = 'width: 100%; margin-bottom: 1rem; border-radius: 0.5rem; pointer-events: none;'
        previewVideo.srcObject = stream
        
        // Create button container
        const buttonContainer = document.createElement('div')
        buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; pointer-events: auto;'
        
        // Disable pointer events on all dialogs below first
        const existingDialogs = document.querySelectorAll('[data-radix-dialog-content]')
        const dialogOverlays = document.querySelectorAll('[data-radix-dialog-overlay]')
        
        existingDialogs.forEach((dialog: any) => {
          dialog.style.pointerEvents = 'none'
        })
        
        dialogOverlays.forEach((overlay: any) => {
          overlay.style.pointerEvents = 'none'
        })
        
        // Prevent Dialog from closing while camera modal is open
        const preventDialogClose = (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }
        
        // Add event listeners to prevent dialog close
        existingDialogs.forEach((dialog: any) => {
          dialog.addEventListener('click', preventDialogClose, true)
          dialog.addEventListener('mousedown', preventDialogClose, true)
        })
        
        dialogOverlays.forEach((overlay: any) => {
          overlay.addEventListener('click', preventDialogClose, true)
          overlay.addEventListener('mousedown', preventDialogClose, true)
        })
        
        // Re-enable pointer events and remove listeners when modal is removed
        const cleanup = () => {
          existingDialogs.forEach((dialog: any) => {
            dialog.style.pointerEvents = ''
            dialog.removeEventListener('click', preventDialogClose, true)
            dialog.removeEventListener('mousedown', preventDialogClose, true)
          })
          
          dialogOverlays.forEach((overlay: any) => {
            overlay.style.pointerEvents = ''
            overlay.removeEventListener('click', preventDialogClose, true)
            overlay.removeEventListener('mousedown', preventDialogClose, true)
          })
        }
        
        // Function to close camera modal and re-enable underlying dialog
        const closeModal = () => {
          stream.getTracks().forEach(track => track.stop())
          if (document.body.contains(modal)) {
            document.body.removeChild(modal)
          }
          // Mark camera modal as closed
          setIsCameraModalOpen(false)
          // Re-enable pointer events on underlying dialog
          // Use setTimeout to ensure modal removal is complete
          setTimeout(() => {
            cleanup()
          }, 50)
        }
        
        // Create capture button
        const captureBtn = document.createElement('button')
        captureBtn.id = 'capture-btn'
        captureBtn.type = 'button'
        captureBtn.textContent = 'Ambil Foto'
        captureBtn.style.cssText = 'flex: 1; background-color: rgb(37, 99, 235); color: white; padding: 0.5rem 1rem; border-radius: 0.25rem; border: none; cursor: pointer; font-weight: 500; pointer-events: auto; z-index: 10002; position: relative;'
        
        const handleCapture = (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          context?.drawImage(previewVideo, 0, 0)
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
              handleFileChange(field, file)
            }
            // Close only the camera modal, keep Complete Task dialog open
            closeModal()
          }, 'image/jpeg', 0.9)
        }
        
        captureBtn.addEventListener('click', handleCapture, true)
        captureBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }, true)
        
        // Create cancel button
        const cancelBtn = document.createElement('button')
        cancelBtn.id = 'cancel-btn'
        cancelBtn.type = 'button'
        cancelBtn.textContent = 'Batal'
        cancelBtn.style.cssText = 'flex: 1; background-color: rgb(209, 213, 219); color: rgb(55, 65, 81); padding: 0.5rem 1rem; border-radius: 0.25rem; border: none; cursor: pointer; font-weight: 500; pointer-events: auto; z-index: 10002; position: relative;'
        
        const handleCancel = (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
          // Close only the camera modal, keep Complete Task dialog open
          closeModal()
        }
        
        cancelBtn.addEventListener('click', handleCancel, true)
        cancelBtn.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          e.stopImmediatePropagation()
        }, true)
        
        // Assemble modal
        buttonContainer.appendChild(captureBtn)
        buttonContainer.appendChild(cancelBtn)
        modalContent.appendChild(previewVideo)
        modalContent.appendChild(buttonContainer)
        modal.appendChild(modalContent)
        
        // Block all interactions with underlying content
        modal.addEventListener('click', (e) => {
          // Only allow clicks on the modal content itself
          if (e.target === modal || e.target === modalContent || 
              e.target === previewVideo || e.target === buttonContainer) {
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }, true)
        
        // Prevent any pointer events from reaching elements below
        modal.addEventListener('mousedown', (e) => {
          if (e.target === modal) {
            e.preventDefault()
            e.stopPropagation()
            e.stopImmediatePropagation()
          }
        }, true)
        
        document.body.appendChild(modal)
      })
    } catch (error: any) {
      console.error('Error accessing camera:', error)
      const errorName = error?.name || 'UnknownError'
      let errorMsg = 'Gagal mengakses kamera'
      
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        errorMsg = 'Izin kamera ditolak. Silakan berikan izin kamera di pengaturan browser dan refresh halaman.'
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        errorMsg = 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.'
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.'
      } else if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
        errorMsg = 'Kamera tidak mendukung resolusi yang diminta. Coba gunakan kamera lain.'
      } else if (error?.message) {
        errorMsg = `Gagal mengakses kamera: ${error.message}`
      }
      
      toast.error(errorMsg)
    }
  }

  const handleScanBarcode = async () => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Browser tidak mendukung akses kamera')
        return
      }

      // Dynamic import html5-qrcode first
      let Html5Qrcode
      try {
        const html5QrcodeModule = await import('html5-qrcode')
        Html5Qrcode = html5QrcodeModule.Html5Qrcode || html5QrcodeModule.default?.Html5Qrcode || html5QrcodeModule.default
        if (!Html5Qrcode) {
          throw new Error('Html5Qrcode tidak ditemukan dalam modul html5-qrcode')
        }
      } catch (importError: any) {
        console.error('[SCAN] Error importing html5-qrcode:', importError)
        toast.error('Gagal memuat library scanner. Silakan refresh halaman.')
        return
      }

      // Create modal first
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-white p-4 rounded-lg max-w-md w-full">
          <div id="qr-reader" class="w-full mb-4 rounded"></div>
          <p id="scan-status" class="text-sm text-center text-gray-600 mb-4">Meminta izin kamera...</p>
          <div class="flex gap-2">
            <button id="cancel-scan-btn" class="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded">Batal</button>
          </div>
        </div>
      `
      document.body.appendChild(modal)

      const qrReaderElement = modal.querySelector('#qr-reader') as HTMLDivElement
      const scanStatus = modal.querySelector('#scan-status') as HTMLParagraphElement
      const cancelBtn = modal.querySelector('#cancel-scan-btn') as HTMLButtonElement

      if (!qrReaderElement || !scanStatus) {
        toast.error('Gagal membuat elemen scanner')
        if (document.body.contains(modal)) {
          document.body.removeChild(modal)
        }
        return
      }

      // Request camera permission
      let permissionGranted = false
      let tempStream: MediaStream | null = null
      
      try {
        // Request permission by accessing camera
        scanStatus.textContent = 'Meminta izin kamera...'
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true })
        permissionGranted = true
        // Stop the temporary stream immediately
        tempStream.getTracks().forEach(track => track.stop())
        tempStream = null
      } catch (permissionError: any) {
        const errorName = permissionError?.name || 'UnknownError'
        if (document.body.contains(modal)) {
          document.body.removeChild(modal)
        }
        
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          toast.error('Izin kamera diperlukan untuk scan barcode. Silakan berikan izin kamera di pengaturan browser.')
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          toast.error('Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.')
        } else {
          toast.error('Gagal mengakses kamera: ' + (permissionError?.message || 'Unknown error'))
        }
        return
      }

      // Create Html5Qrcode instance
      const html5QrCode = new Html5Qrcode(qrReaderElement.id)
      
      let isScanning = true
      let isStopped = false

      // Helper function to safely stop scanner
      const safeStopScanner = async () => {
        if (isStopped) {
          return
        }
        isStopped = true
        isScanning = false
        try {
          await html5QrCode.stop()
        } catch (err: any) {
          // Ignore error if scanner is already stopped
          if (err?.message && err.message.includes('not running')) {
          } else {
          }
        }
      }

      // Get camera configuration after permission is granted
      let cameraConfig: string | { facingMode: string } | null = null
      
      try {
        scanStatus.textContent = 'Mencari kamera...'
        // Now enumerate devices (permission already granted)
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(device => device.kind === 'videoinput' && device.deviceId)
        
        if (videoDevices.length === 0) {
          throw new Error('Tidak ada kamera yang tersedia')
        }
        
        // Try to find back camera
        const backCamera = videoDevices.find(device => {
          const label = device.label.toLowerCase()
          return label.includes('back') || label.includes('rear') || label.includes('environment')
        })
        
        if (backCamera && backCamera.deviceId) {
          cameraConfig = backCamera.deviceId
          console.log('[SCAN] Using back camera:', backCamera.label)
        } else if (videoDevices[0]?.deviceId) {
          // Use first available camera
          cameraConfig = videoDevices[0].deviceId
          console.log('[SCAN] Using first available camera:', videoDevices[0].label)
        } else {
          throw new Error('Tidak ada kamera yang valid')
        }
      } catch (err: any) {
        console.error('[SCAN] Error enumerating devices:', err)
        // Fallback to facingMode if device enumeration fails
        cameraConfig = { facingMode: 'environment' }
        console.log('[SCAN] Falling back to facingMode: environment')
      }

      // Ensure cameraConfig is not null
      if (!cameraConfig) {
        cameraConfig = { facingMode: 'environment' }
      }
      
      const onScanSuccess = async (decodedText: string, decodedResult: any) => {
        if (isScanning) {
          isScanning = false
          
          // Parse QR code data
          let qrData: { code?: string; latitude?: number; longitude?: number } = {}
          let scannedCodeValue: string = ''
          try {
            qrData = JSON.parse(decodedText)
            console.log('[SCAN] Parsed QR data:', qrData)
            // Extract scan code from QR data
            scannedCodeValue = qrData.code || decodedText
          } catch (e) {
            console.error('[SCAN] Failed to parse QR code as JSON:', e)
            // If not JSON, just use the text as scan code
            scannedCodeValue = decodedText
            qrData = { code: decodedText }
          }

          // Validate scan code matches task scan code
          const taskScanCode = task?.scan_code?.trim()
          const isValidScanCode = taskScanCode && scannedCodeValue.trim() === taskScanCode
          
          console.log('[SCAN] Scan code validation:', {
            scannedCode: scannedCodeValue,
            taskScanCode: taskScanCode,
            isValid: isValidScanCode
          })

          if (!isValidScanCode) {
            // Scan code doesn't match
            scanStatus.textContent = 'QR Code tidak sesuai dengan task ini!'
            scanStatus.className = 'text-sm text-center text-red-600 mb-4 font-medium'
            setIsScanCodeValid(false)
            setScannedCode(scannedCodeValue)
            toast.error(`QR Code tidak sesuai! Task ini memerlukan scan code: ${taskScanCode || 'tidak ada'}`)
            
            // Stop scanner and close modal
            await safeStopScanner()
            if (document.body.contains(modal)) {
              document.body.removeChild(modal)
            }
            return
          }

          // Scan code is valid, continue with location check
          setIsScanCodeValid(true)
          setScannedCode(scannedCodeValue)

          // Check location if latitude and longitude are present
          if (qrData.latitude !== undefined && qrData.longitude !== undefined) {
            scanStatus.textContent = 'Memvalidasi lokasi...'
            scanStatus.className = 'text-sm text-center text-blue-600 mb-4 font-medium'
            
            try {
              const isValid = await checkLocation(qrData.latitude, qrData.longitude)
              setQrLocation({ latitude: qrData.latitude, longitude: qrData.longitude })
              
              if (isValid) {
                scanStatus.textContent = 'QR Code dan lokasi valid!'
                scanStatus.className = 'text-sm text-center text-green-600 mb-4 font-medium'
              } else {
                scanStatus.textContent = 'Lokasi tidak sesuai!'
                scanStatus.className = 'text-sm text-center text-red-600 mb-4 font-medium'
              }
            } catch (error: any) {
              console.error('[SCAN] Location check failed:', error)
              scanStatus.textContent = 'Gagal memvalidasi lokasi'
              scanStatus.className = 'text-sm text-center text-yellow-600 mb-4 font-medium'
              // Still allow scan code to be set, but location validation failed
            }
          } else {
            scanStatus.textContent = 'QR Code berhasil di-scan!'
            scanStatus.className = 'text-sm text-center text-green-600 mb-4 font-medium'
            setIsLocationValid(true) // No location check needed
          }
          
          // Set scan code first
          setFormData(prev => ({ ...prev, scanCode: decodedText }))

          // Capture screenshot for evidence and close modal
          setTimeout(() => {
            const videoElement = qrReaderElement.querySelector('video') as HTMLVideoElement
            if (videoElement && videoElement.videoWidth && videoElement.videoHeight) {
              const canvas = document.createElement('canvas')
              const context = canvas.getContext('2d')
              if (context) {
                canvas.width = videoElement.videoWidth
                canvas.height = videoElement.videoHeight
                context.drawImage(videoElement, 0, 0)
                
                canvas.toBlob((blob) => {
                  if (blob) {
                    console.log('[SCAN] Image captured:', {
                      size: blob.size,
                      type: blob.type
                    })
                    const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' })
                    setFormData(prev => ({ ...prev, fileScan: file, scanCode: decodedText }))
                    handleFileChange('fileScan', file)
                  }
                  // Stop scanner and close modal after screenshot is captured
                  safeStopScanner().then(() => {
                    if (document.body.contains(modal)) {
                      document.body.removeChild(modal)
                    }
                    toast.success('QR Code berhasil di-scan!')
                  })
                }, 'image/jpeg', 0.9)
              } else {
                // If canvas context is not available, stop scanner and close modal immediately
                safeStopScanner().then(() => {
                  if (document.body.contains(modal)) {
                    document.body.removeChild(modal)
                  }
                  toast.success('QR Code berhasil di-scan!')
                })
              }
            } else {
              // If video element is not available, stop scanner and close modal immediately
              safeStopScanner().then(() => {
                if (document.body.contains(modal)) {
                  document.body.removeChild(modal)
                }
                toast.success('QR Code berhasil di-scan!')
              })
            }
          }, 100)
        }
      }

      const onScanError = (errorMessage: string) => {
        // Ignore scan errors, just keep scanning
        // Only log occasionally to avoid spam
        if (Math.random() < 0.02) {
          console.log('[SCAN] Scanning...', errorMessage)
        }
      }

      // Start scanning with the configured camera
      scanStatus.textContent = 'Memulai scanner...'
      
      try {
        if (!cameraConfig) {
          throw new Error('Konfigurasi kamera tidak tersedia')
        }
        
        await html5QrCode.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
          },
          onScanSuccess,
          onScanError
        )
        
        scanStatus.textContent = 'Arahkan kamera ke QR code'
        scanStatus.className = 'text-sm text-center text-gray-600 mb-4'
        
      } catch (err: any) {
        console.error('[SCAN] Error starting scanner:', err)
        const errorMessage = err?.message || err?.toString() || 'Unknown error'
        const errorName = err?.name || 'UnknownError'
        
        // Try fallback cameras
        const fallbackConfigs = [
          { facingMode: 'user' },
          { facingMode: 'environment' }
        ]
        
        let started = false
        
        for (const fallbackConfig of fallbackConfigs) {
          // Skip if already tried
          if (typeof cameraConfig === 'object' && 
              cameraConfig.facingMode === fallbackConfig.facingMode) {
            continue
          }
          
          try {
            console.log(`[SCAN] Trying fallback camera: ${fallbackConfig.facingMode}`)
            scanStatus.textContent = `Mencoba kamera alternatif...`
            
            await html5QrCode.start(
              fallbackConfig,
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                disableFlip: false,
              },
              onScanSuccess,
              onScanError
            )
            
            scanStatus.textContent = 'Arahkan kamera ke QR code'
            scanStatus.className = 'text-sm text-center text-gray-600 mb-4'
            started = true
            break
          } catch (fallbackErr: any) {
            console.error(`[SCAN] Fallback camera ${fallbackConfig.facingMode} failed:`, fallbackErr)
            continue
          }
        }
        
        if (!started) {
          let errorMsg = 'Gagal memulai scanner'
          if (errorMessage.includes('cameraIdOrConfig is required')) {
            errorMsg = 'Konfigurasi kamera tidak valid. Silakan coba lagi atau refresh halaman.'
          } else if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
            errorMsg = 'Izin kamera ditolak. Silakan berikan izin kamera di pengaturan browser.'
          } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
            errorMsg = 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.'
          } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
            errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.'
          } else if (errorMessage && errorMessage !== 'Unknown error') {
            errorMsg = `Gagal memulai scanner: ${errorMessage}`
          }
          
          toast.error(errorMsg)
          if (document.body.contains(modal)) {
            document.body.removeChild(modal)
          }
          return
        }
      }

      // Update status periodically
      let statusUpdateInterval = setInterval(() => {
        if (isScanning) {
          const elapsed = Math.floor(Date.now() / 1000) % 60
          scanStatus.textContent = `Mencari QR code... (${elapsed}s)`
        }
      }, 1000)

      cancelBtn.onclick = async () => {
        isScanning = false
        clearInterval(statusUpdateInterval)
        
        await safeStopScanner()
        
        if (document.body.contains(modal)) {
          document.body.removeChild(modal)
        }
      }
    } catch (error: any) {
      console.error('[SCAN] Unexpected error in handleScanBarcode:', error)
      const errorMessage = error?.message || error?.toString() || 'Unknown error'
      const errorName = error?.name || 'UnknownError'
      
      let errorMsg = 'Gagal mengakses kamera untuk scan barcode'
      
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        errorMsg = 'Izin kamera ditolak. Silakan berikan izin kamera di pengaturan browser.'
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        errorMsg = 'Kamera tidak ditemukan. Pastikan perangkat memiliki kamera.'
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.'
      } else if (errorName === 'OverconstrainedError' || errorName === 'ConstraintNotSatisfiedError') {
        errorMsg = 'Kamera tidak mendukung resolusi yang diminta.'
      } else if (errorMessage && errorMessage !== 'Unknown error') {
        errorMsg = errorMessage
      }
      
      toast.error(errorMsg)
    }
  }

  const handleSubmit = async () => {
    if (!userTask || !task) return

    // Role-based attachment validation
    if (task.is_need_validation) {
      const hasBefore = formData.fileBefore !== null
      const hasAfter = formData.fileAfter !== null
      
      // For keamanan role: must have after attachment only
      if (userRoleName?.toLowerCase() === 'keamanan' || userRoleName?.toLowerCase() === 'security') {
        if (!hasAfter) {
          toast.error('Untuk role keamanan, wajib mengupload foto After')
          return
        }
        if (hasBefore) {
          toast.error('Untuk role keamanan, hanya boleh mengupload foto After')
          return
        }
      }
      
      // For kebersihan role: must have both before AND after attachments
      if (userRoleName?.toLowerCase() === 'kebersihan' || userRoleName?.toLowerCase() === 'cleaning') {
        if (!hasBefore || !hasAfter) {
          toast.error('Untuk role kebersihan, wajib mengupload foto Before dan After')
          return
        }
      }
    }

    // Validation: If task requires scan, scan code must be provided
    if (task.is_scan) {
      if (!formData.scanCode || formData.scanCode.trim() === '') {
        toast.error('Task ini memerlukan scan barcode. Silakan scan QR code terlebih dahulu.')
        return
      }

      // Validate scan code matches task scan code
      let scannedCodeValue = ''
      try {
        const qrData = JSON.parse(formData.scanCode)
        scannedCodeValue = qrData.code || formData.scanCode
      } catch (e) {
        scannedCodeValue = formData.scanCode
      }

      const taskScanCode = task.scan_code?.trim()
      if (taskScanCode && scannedCodeValue.trim() !== taskScanCode) {
        toast.error(`QR Code tidak sesuai dengan task ini! Task ini memerlukan scan code: ${taskScanCode}`)
        return
      }

      // Check if scan code validation failed
      if (isScanCodeValid === false) {
        toast.error('QR Code tidak sesuai dengan task ini. Silakan scan QR code yang benar.')
        return
      }

      // Check location validation if QR code has location data
      if (qrLocation) {
        if (isLocationValid === false) {
          toast.error('Anda tidak berada di lokasi yang benar. Silakan scan ulang QR code di lokasi yang tepat.')
          return
        }
        
        if (isLocationValid === null || isCheckingLocation) {
          toast.error('Sedang memvalidasi lokasi. Silakan tunggu sebentar.')
          return
        }

        // Re-check location before submit to ensure user is still at the location
        try {
          const isValid = await checkLocation(qrLocation.latitude, qrLocation.longitude)
          if (!isValid) {
            toast.error('Anda tidak berada di lokasi yang benar. Silakan scan ulang QR code di lokasi yang tepat.')
            return
          }
        } catch (error: any) {
          toast.error('Gagal memvalidasi lokasi: ' + error.message)
          return
        }
      } else {
        // If QR code doesn't have location, just ensure scan code is valid
        if (!formData.scanCode || formData.scanCode.trim() === '') {
          toast.error('Scan code tidak valid. Silakan scan ulang QR code.')
          return
        }
      }
    }

    try {
      setIsSubmitting(true)

      const userTaskId = userTask.user_task_id || userTask.id
      if (!userTaskId) {
        toast.error('User task ID tidak ditemukan')
        return
      }

      // Check if we need to upload files
      const hasFiles = formData.fileBefore || formData.fileAfter || formData.fileScan

      if (hasFiles) {
        const formDataToSend = new FormData()
        if (formData.remark) {
          formDataToSend.append('notes', formData.remark)
        }
        if (formData.fileBefore) {
          formDataToSend.append('file_before', formData.fileBefore)
        }
        if (formData.fileAfter) {
          formDataToSend.append('file_after', formData.fileAfter)
        }
        if (formData.fileScan) {
          formDataToSend.append('file_scan', formData.fileScan)
        }
        if (formData.scanCode) {
          formDataToSend.append('scan_code', formData.scanCode)
        }

        const response = await userTasksApi.completeUserTaskWithFiles(Number(userTaskId), formDataToSend)

        if (response.success) {
          toast.success('Task berhasil diselesaikan')
          onOpenChange(false)
          resetForm()
          onComplete()
          
          // Check if this is a child task and auto-complete parent if all children are done
          await checkAndCompleteParentTask(userTask)
        } else {
          throw new Error(response.error || 'Gagal menyelesaikan task')
        }
      } else {
        const response = await userTasksApi.completeUserTask(
          Number(userTaskId),
          formData.remark ? { notes: formData.remark } : undefined
        )

        if (response.success) {
          toast.success('Task berhasil diselesaikan')
          onOpenChange(false)
          resetForm()
          onComplete()
          
          // Check if this is a child task and auto-complete parent if all children are done
          await checkAndCompleteParentTask(userTask)
        } else {
          throw new Error(response.error || 'Gagal menyelesaikan task')
        }
      }
    } catch (error: any) {
      console.error('Error completing task:', error)
      toast.error(error.message || 'Terjadi kesalahan saat menyelesaikan task')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      remark: '',
      fileBefore: null,
      fileAfter: null,
      fileScan: null,
      scanCode: ''
    })
    setFilePreview({})
    setQrLocation(null)
    setIsLocationValid(null)
    setIsCheckingLocation(false)
    setIsScanCodeValid(null)
    setScannedCode(null)
  }

  // Check if all child tasks are completed and auto-complete parent if needed
  const checkAndCompleteParentTask = async (completedUserTask: UserTask) => {
    try {
      // Check if this is a child task (has parent_user_task_id)
      const parentUserTaskId = completedUserTask.parent_user_task_id
      
      if (!parentUserTaskId) {
        // This is not a child task (no parent), no need to check
        return
      }

      // Fetch updated tasks to get current status
      const response = await userTasksApi.getUserTasks()
      if (!response.success || !response.data) {
        console.error('Failed to fetch tasks for parent check')
        return
      }

      const responseData = response.data as any
      let allTasks: UserTask[] = []
      
      if (Array.isArray(responseData)) {
        allTasks = responseData
      } else if (responseData && typeof responseData === 'object' && Array.isArray(responseData.data)) {
        allTasks = responseData.data
      } else if (responseData && typeof responseData === 'object' && responseData.tasks && Array.isArray(responseData.tasks)) {
        allTasks = responseData.tasks
      }

      // Find parent task
      const parentTask = allTasks.find((task: UserTask) => {
        const taskId = task.user_task_id || task.id
        return taskId && (taskId.toString() === parentUserTaskId.toString())
      })

      if (!parentTask) {
        console.log('Parent task not found')
        return
      }

      // Check if parent task is a main task
      const isParentMainTask = parentTask.task?.is_main_task || parentTask.is_main_task
      if (!isParentMainTask) {
        // Parent is not a main task, don't auto-complete
        return
      }

      // Check if parent task is already completed
      const isParentCompleted = parentTask.status === 'completed' || parentTask.completed_at
      if (isParentCompleted) {
        return
      }

      // Get all child tasks (sub_user_task)
      const childTasks = parentTask.sub_user_task || []
      
      if (childTasks.length === 0) {
        // No child tasks, nothing to check
        return
      }

      // Check if all child tasks are completed
      const allChildrenCompleted = childTasks.every((childTask: UserTask) => {
        return childTask.status === 'completed' || childTask.completed_at
      })

      if (allChildrenCompleted) {
        // All children are completed, auto-complete parent
        const parentTaskId = parentTask.user_task_id || parentTask.id
        if (!parentTaskId) {
          console.error('Parent task ID not found')
          return
        }

        const completeResponse = await userTasksApi.completeUserTask(Number(parentTaskId), {
          notes: 'Auto-completed: All child tasks are completed'
        })

        if (completeResponse.success) {
          toast.success('Main task otomatis diselesaikan karena semua child task sudah selesai')
          // Trigger reload
          onComplete()
        } else {
          console.error('Failed to auto-complete parent task:', completeResponse.error)
        }
      }
    } catch (error) {
      console.error('Error checking and completing parent task:', error)
      // Don't show error to user, this is a background operation
    }
  }

  if (!userTask || !task) return null

  // Prevent dialog from closing while camera modal is open
  const handleDialogOpenChange = (newOpen: boolean) => {
    if (!newOpen && isCameraModalOpen) {
      // Don't close if camera modal is open
      return
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Task: {task.name}</DialogTitle>
          <DialogDescription>
            Lengkapi form untuk menyelesaikan task
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Form (if is_need_validation) */}
          {task.is_need_validation && (
            <div className="space-y-4">
              {/* Role-based requirement message */}
              {(userRoleName?.toLowerCase() === 'keamanan' || userRoleName?.toLowerCase() === 'security') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Catatan:</strong> Untuk role keamanan, Anda wajib mengupload foto After
                  </p>
                </div>
              )}
              {(userRoleName?.toLowerCase() === 'kebersihan' || userRoleName?.toLowerCase() === 'cleaning') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    <strong>Catatan:</strong> Untuk role kebersihan, Anda wajib mengupload foto Before <strong>dan</strong> After
                  </p>
                </div>
              )}
              
              {/* Foto Before - hanya untuk kebersihan */}
              {(userRoleName?.toLowerCase() === 'kebersihan' || userRoleName?.toLowerCase() === 'cleaning') && (
                <div>
                  <Label>Foto Before <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => captureFromCamera('fileBefore')}
                      className="flex items-center gap-2"
                    >
                      <Camera className="h-4 w-4" />
                      Ambil Foto
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileChange('fileBefore', file)
                      }}
                      className="hidden"
                      id="file-before-input"
                    />
                    <label htmlFor="file-before-input">
                      <Button type="button" variant="outline" asChild>
                        <span>Pilih File</span>
                      </Button>
                    </label>
                  </div>
                  {filePreview.before && (
                    <img
                      src={filePreview.before}
                      alt="Before"
                      className="mt-2 w-full max-w-xs h-32 object-cover rounded"
                    />
                  )}
                </div>
              )}

              <div>
                <Label>Foto After {
                  ((userRoleName?.toLowerCase() === 'kebersihan' || userRoleName?.toLowerCase() === 'cleaning') || 
                   (userRoleName?.toLowerCase() === 'keamanan' || userRoleName?.toLowerCase() === 'security')) && 
                  <span className="text-red-500">*</span>
                }</Label>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => captureFromCamera('fileAfter')}
                    className="flex items-center gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Ambil Foto
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileChange('fileAfter', file)
                    }}
                    className="hidden"
                    id="file-after-input"
                  />
                  <label htmlFor="file-after-input">
                    <Button type="button" variant="outline" asChild>
                      <span>Pilih File</span>
                    </Button>
                  </label>
                </div>
                {filePreview.after && (
                  <img
                    src={filePreview.after}
                    alt="After"
                    className="mt-2 w-full max-w-xs h-32 object-cover rounded"
                  />
                )}
              </div>
            </div>
          )}

          {/* Scan Form (if is_scan) */}
          {task.is_scan && (
            <div>
              <Label>Scan Barcode</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleScanBarcode}
                  className="flex items-center gap-2 text-xs sm:text-sm"
                >
                  <Camera className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Scan Barcode</span>
                  <span className="sm:hidden">Scan</span>
                </Button>
              </div>
              {filePreview.scan && (
                <img
                  src={filePreview.scan}
                  alt="Scan"
                  className="mt-2 w-full max-w-xs h-24 sm:h-32 object-cover rounded"
                />
              )}
              {formData.scanCode && (
                <div className="mt-2 space-y-2">
                  <div className="p-2 bg-gray-100 rounded text-xs sm:text-sm break-all">
                    <span className="font-medium">Kode:</span> {scannedCode || formData.scanCode}
                  </div>
                  {/* Scan Code Validation Status */}
                  {isScanCodeValid === false && (
                    <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-red-600 font-medium">
                      <span className="text-base sm:text-lg flex-shrink-0">✗</span>
                      <span className="break-words">QR Code tidak sesuai dengan task ini. Task ini memerlukan scan code: {task.scan_code || 'tidak ada'}</span>
                    </div>
                  )}
                  {isScanCodeValid === true && (
                    <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-green-600 font-medium">
                      <span className="text-base sm:text-lg flex-shrink-0">✓</span>
                      <span className="break-words">QR Code sesuai dengan task ini</span>
                    </div>
                  )}
                  {qrLocation && (
                    <div className="space-y-1.5">
                      {isCheckingLocation && (
                        <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-blue-600">
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mt-0.5 sm:mt-0 flex-shrink-0" />
                          <span className="break-words">Memvalidasi lokasi...</span>
                        </div>
                      )}
                      {!isCheckingLocation && isLocationValid === true && (
                        <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-green-600 font-medium">
                          <span className="text-base sm:text-lg flex-shrink-0">✓</span>
                          <span className="break-words">Lokasi valid - Anda berada di lokasi yang benar</span>
                        </div>
                      )}
                      {!isCheckingLocation && isLocationValid === false && (
                        <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-red-600 font-medium">
                          <span className="text-base sm:text-lg flex-shrink-0">✗</span>
                          <span className="break-words">Lokasi tidak valid - Anda terlalu jauh dari lokasi QR code</span>
                        </div>
                      )}
                      {!isCheckingLocation && isLocationValid === null && (
                        <div className="flex items-start sm:items-center gap-2 text-xs sm:text-sm text-yellow-600 font-medium">
                          <span className="text-base sm:text-lg flex-shrink-0">⚠</span>
                          <span className="break-words">Gagal memvalidasi lokasi</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Remark */}
          <div>
            <Label htmlFor="remark">Remark</Label>
            <Textarea
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
              placeholder="Masukkan catatan..."
              className="mt-2"
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                resetForm()
              }}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(() => {
                // Always disabled if submitting or checking location
                if (isSubmitting || isCheckingLocation) {
                  return true
                }

                // Validation for scan barcode
                if (task.is_scan) {
                  // Must have scan code
                  if (!formData.scanCode || formData.scanCode.trim() === '') {
                    return true
                  }
                  
                  // Scan code must be valid (match task scan code)
                  if (isScanCodeValid === false) {
                    return true
                  }
                  
                  // If QR code has location data, location must be valid
                  if (qrLocation !== null) {
                    // Disabled if location is invalid or validation hasn't completed
                    if (isLocationValid === false || isLocationValid === null) {
                      return true
                    }
                    // Only enabled if location is valid (isLocationValid === true)
                  }
                  // If no location data, just need scan code (already checked above)
                }

                // Validation for photo attachments (is_need_validation)
                if (task.is_need_validation) {
                  // For keamanan role: only need fileAfter
                  if (userRoleName?.toLowerCase() === 'keamanan' || userRoleName?.toLowerCase() === 'security') {
                    if (!formData.fileAfter) {
                      return true
                    }
                    // Must not have fileBefore for keamanan
                    if (formData.fileBefore) {
                      return true
                    }
                  }
                  // For kebersihan role: need both fileBefore and fileAfter
                  else if (userRoleName?.toLowerCase() === 'kebersihan' || userRoleName?.toLowerCase() === 'cleaning') {
                    if (!formData.fileBefore || !formData.fileAfter) {
                      return true
                    }
                  }
                  // For other roles: need at least one file
                  else {
                    if (!formData.fileBefore && !formData.fileAfter) {
                      return true
                    }
                  }
                }

                return false
              })()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

