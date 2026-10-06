import { describe, expect, it } from 'vitest';
import { hitsFromItunes, hitsFromSteam, hitsFromTeams } from './media.service';

describe('media catalog parsers', () => {
  it('reads movie titles and artwork from iTunes', () => {
    const hits = hitsFromItunes('movie', {
      results: [
        { trackId: 1, trackName: 'Inception', primaryGenreName: 'Aksiyon', artworkUrl100: 'https://example.com/100x100bb.jpg' },
        { trackId: 1, trackName: 'Inception', artworkUrl100: 'http://insecure.example/a.jpg' },
      ],
    });
    expect(hits).toEqual([
      { id: 'movie:1', title: 'Inception', subtitle: 'Aksiyon', imageUrl: 'https://example.com/200x200bb.jpg' },
    ]);
  });

  it('reads games from Steam and teams from SportsDB', () => {
    expect(hitsFromSteam({ items: [{ id: 9, name: 'Elden Ring', tiny_image: 'https://cdn.example/g.jpg' }] })).toEqual([
      { id: 'game:9', title: 'Elden Ring', subtitle: null, imageUrl: 'https://cdn.example/g.jpg' },
    ]);
    expect(
      hitsFromTeams({ teams: [{ idTeam: '133', strTeam: 'Fenerbahçe', strLeague: 'Süper Lig', strTeamBadge: 'https://cdn.example/fb.png' }] }),
    ).toEqual([{ id: 'team:133', title: 'Fenerbahçe', subtitle: 'Süper Lig', imageUrl: 'https://cdn.example/fb.png' }]);
  });
});
