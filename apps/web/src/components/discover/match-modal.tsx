'use client';

import type { MatchSummaryDto } from '@dating/types';
import { Button, Modal, buttonClasses } from '@dating/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useMyProfile } from '@/lib/queries';

function Avatar({ src, alt }: { src: string | undefined; alt: string }) {
  return (
    <div className="bg-surface-2 border-primary relative size-24 overflow-hidden rounded-full border-4 shadow-xl">
      {src && <Image src={src} alt={alt} fill unoptimized sizes="96px" className="object-cover" />}
    </div>
  );
}

export function MatchModal({ match, onClose }: { match: MatchSummaryDto | null; onClose: () => void }) {
  const me = useMyProfile();
  const myPhoto = me.data?.photos.find((photo) => photo.status === 'APPROVED')?.urls?.thumb;

  return (
    <Modal open={match !== null} onClose={onClose} title="Eşleştiniz!" hideTitle>
      {match && (
        <div className="space-y-6 text-center">
          <div className="flex justify-center -space-x-4">
            <Avatar src={myPhoto} alt="Sen" />
            <Avatar src={match.user.photo?.thumb} alt={match.user.firstName} />
          </div>
          <div className="space-y-1">
            <p className="bg-accent-gradient bg-clip-text text-4xl font-black text-transparent">Eşleştiniz!</p>
            <p className="text-text-muted text-sm">Sen ve {match.user.firstName} birbirinizi beğendiniz.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href={`/matches/${match.id}`} className={buttonClasses({ size: 'lg', fullWidth: true })}>
              Mesaj gönder
            </Link>
            <Button variant="ghost" fullWidth onClick={onClose}>
              Keşfetmeye devam et
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
