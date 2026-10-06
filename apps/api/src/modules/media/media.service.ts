import { Injectable } from '@nestjs/common';
import type { MediaHitDto, MediaKind } from '@dating/types';
import type { MediaSearchInput } from '@dating/validation';

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; hits: MediaHitDto[] }>();

const SEEDS: Record<MediaKind, readonly string[]> = {
  movie: ['inception', 'interstellar', 'parasite', 'dune'],
  show: ['elite', 'dark', 'wednesday', 'sherlock'],
  game: ['elden ring', 'minecraft', 'gta', 'valorant'],
  team: ['Fenerbahce', 'Galatasaray', 'Barcelona', 'Liverpool'],
  song: ['blinding lights', 'as it was', 'flowers'],
  artist: ['the weeknd', 'duman', 'sezen aksu', 'taylor swift'],
};

interface ItunesPayload {
  results?: Array<{
    trackId?: number;
    collectionId?: number;
    artistId?: number;
    trackName?: string;
    collectionName?: string;
    artistName?: string;
    primaryGenreName?: string;
    artworkUrl100?: string;
  }>;
}

interface SteamPayload {
  items?: Array<{ id: number; name: string; tiny_image?: string }>;
}

interface SportsPayload {
  teams?: Array<{
    idTeam?: string;
    strTeam?: string;
    strLeague?: string;
    strTeamBadge?: string | null;
  }> | null;
}

function artwork(url: string | undefined): string | null {
  if (!url || !url.startsWith('https://')) return null;
  return url.replace('100x100bb', '200x200bb');
}

function unique(hits: MediaHitDto[]): MediaHitDto[] {
  const seen = new Set<string>();
  return hits.filter((hit) => {
    const key = hit.title.toLocaleLowerCase('tr');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hitsFromItunes(kind: MediaKind, payload: ItunesPayload): MediaHitDto[] {
  return unique(
    (payload.results ?? []).flatMap((item) => {
      const title =
        kind === 'artist'
          ? item.artistName
          : kind === 'show'
            ? item.collectionName
            : item.trackName;
      if (!title) return [];
      const subtitle = kind === 'song' || kind === 'show' ? (item.artistName ?? null) : (item.primaryGenreName ?? null);
      const id = String(item.trackId ?? item.collectionId ?? item.artistId ?? title);
      return [{ id: `${kind}:${id}`, title, subtitle, imageUrl: artwork(item.artworkUrl100) }];
    }),
  );
}

export function hitsFromSteam(payload: SteamPayload): MediaHitDto[] {
  return unique(
    (payload.items ?? []).flatMap((item) => {
      if (!item.name) return [];
      const image = item.tiny_image?.startsWith('https://') ? item.tiny_image : null;
      return [{ id: `game:${item.id}`, title: item.name, subtitle: null, imageUrl: image }];
    }),
  );
}

export function hitsFromTeams(payload: SportsPayload): MediaHitDto[] {
  return unique(
    (payload.teams ?? []).flatMap((team) => {
      if (!team.strTeam) return [];
      const image = team.strTeamBadge?.startsWith('https://') ? team.strTeamBadge : null;
      return [{ id: `team:${team.idTeam ?? team.strTeam}`, title: team.strTeam, subtitle: team.strLeague ?? null, imageUrl: image }];
    }),
  );
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function searchOnce(kind: MediaKind, term: string): Promise<MediaHitDto[]> {
  const q = encodeURIComponent(term);
  if (kind === 'game') {
    const payload = await getJson<SteamPayload>(
      `https://store.steampowered.com/api/storesearch/?term=${q}&l=turkish&cc=TR`,
    );
    return payload ? hitsFromSteam(payload).slice(0, 8) : [];
  }
  if (kind === 'team') {
    const payload = await getJson<SportsPayload>(
      `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${q}`,
    );
    return payload ? hitsFromTeams(payload).slice(0, 8) : [];
  }
  const entity = kind === 'movie' ? 'movie' : kind === 'show' ? 'tvShow' : kind === 'song' ? 'song' : 'musicArtist';
  const payload = await getJson<ItunesPayload>(
    `https://itunes.apple.com/search?term=${q}&entity=${entity}&limit=8&country=tr`,
  );
  return payload ? hitsFromItunes(kind, payload).slice(0, 8) : [];
}

@Injectable()
export class MediaService {
  async search(input: MediaSearchInput): Promise<MediaHitDto[]> {
    const kind = input.kind;
    const query = input.q.trim();
    const key = `${kind}:${query.toLocaleLowerCase('tr')}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.hits;

    const terms = query.length >= 2 ? [query] : SEEDS[kind];
    const batches = await Promise.all(terms.map((term) => searchOnce(kind, term)));
    const hits = unique(batches.flat()).slice(0, 12);
    cache.set(key, { at: Date.now(), hits });
    return hits;
  }
}
