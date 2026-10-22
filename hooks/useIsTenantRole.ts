'use client'

import { useEffect, useState } from 'react'
import { getAuthRoleName } from '@/lib/auth-utils'

/**
 * Apakah user yang login memakai role `tenant`.
 *
 * Role dibaca dari payload JWT, jadi hasilnya tersedia tanpa request tambahan.
 * Pembacaan dilakukan di useEffect (bukan initializer) supaya render pertama di
 * server dan di client sama.
 *
 * @returns `null` selama role belum diketahui, lalu `true`/`false`.
 *          Perlakukan `null` sebagai "belum boleh menampilkan kontrol tulis".
 */
export function useIsTenantRole(): boolean | null {
  const [isTenantRole, setIsTenantRole] = useState<boolean | null>(null)

  useEffect(() => {
    setIsTenantRole(getAuthRoleName() === 'tenant')
  }, [])

  return isTenantRole
}

/**
 * Kebalikan dari useIsTenantRole untuk dipakai sebagai gerbang kontrol tulis:
 * `true` hanya bila sudah dipastikan user BUKAN role tenant.
 */
export function useCanWriteTenantData(): boolean {
  return useIsTenantRole() === false
}
