'use client';

import type { AdminUserSummaryDto, UserRole, UserStatus } from '@dating/types';
import { Button, Field, Input, Select } from '@dating/ui';
import Link from 'next/link';
import { useState } from 'react';
import { AdminLoad, FilterBar, LoadMore } from '../_components';
import { useAdminUsers } from '@/lib/admin';
import { formatDate } from '@/lib/format';

const STATUS: Record<UserStatus, string> = {
  ACTIVE: 'Aktif',
  RESTRICTED: 'Kısıtlı',
  BANNED: 'Yasaklı',
  DEACTIVATED: 'Kapatılmış',
};

const ROLE: Record<UserRole, string> = { USER: 'Kullanıcı', MODERATOR: 'Moderatör', ADMIN: 'Admin' };

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [applied, setApplied] = useState({ q: '', status: '', role: '' });
  const users = useAdminUsers(applied);
  const rows = users.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Kullanıcılar</h1>
      <form
        className="contents"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ q, status, role });
        }}
      >
        <FilterBar>
          <Field label="Ara">
            <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Email, kullanıcı adı" />
          </Field>
          <Field label="Durum">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol">
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="">Tümü</option>
              {Object.entries(ROLE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Filtrele</Button>
        </FilterBar>
      </form>
      <AdminLoad pending={users.isPending} error={users.error}>
        {rows.length === 0 ? (
          <p className="text-text-muted text-sm">Kullanıcı bulunamadı.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-text-muted text-xs uppercase">
                <tr>
                  <th className="py-2 pr-3">Kullanıcı</th>
                  <th className="py-2 pr-3">Rol</th>
                  <th className="py-2 pr-3">Durum</th>
                  <th className="py-2 pr-3">Paket</th>
                  <th className="py-2 pr-3">Rapor</th>
                  <th className="py-2">Kayıt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user: AdminUserSummaryDto) => (
                  <tr key={user.id} className="border-text/5 border-t">
                    <td className="py-3 pr-3">
                      <Link href={`/admin/users/${user.id}`} className="text-primary hover:underline">
                        {user.firstName ?? '—'} @{user.username ?? 'yok'}
                      </Link>
                      <p className="text-text-muted text-xs">{user.email}</p>
                    </td>
                    <td className="py-3 pr-3">{ROLE[user.role]}</td>
                    <td className="py-3 pr-3">{STATUS[user.status]}</td>
                    <td className="py-3 pr-3">{user.plan}</td>
                    <td className="py-3 pr-3">{user.openReports}</td>
                    <td className="py-3">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore
          hasNext={Boolean(users.hasNextPage)}
          loading={users.isFetchingNextPage}
          onClick={() => void users.fetchNextPage()}
        />
      </AdminLoad>
    </div>
  );
}
