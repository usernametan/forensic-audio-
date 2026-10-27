import { Mic2, Users } from 'lucide-react';
import { SPEAKER_COLORS } from '../data/constants';
import { formatDuration, pluralize } from '../utils/format';

export function speakerLabel(value) {
  if (!value) return 'Unlabelled';
  return String(value).replace(/^SPEAKER[_-]?/i, 'Speaker ');
}

export default function SpeakerTimeline({ segments = [], duration = 0, emptyText = 'No diarization segments are available.' }) {
  if (!segments.length) {
    return (
      <div className="empty-state compact">
        <Users size={20} aria-hidden="true" />
        <p>{emptyText}</p>
        <span>Speaker turns appear only after a diarization result is returned by the backend.</span>
      </div>
    );
  }

  const maxTime = duration || Math.max(...segments.map((segment) => Number(segment.end) || 0), 1);
  const grouped = new Map();
  for (const segment of segments) {
    const key = segment.speaker || 'Unlabelled';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(segment);
  }

  return (
    <div className="speaker-timeline">
      <div className="speaker-lane-list">
        {Array.from(grouped.entries()).map(([speaker, turns], index) => {
          const color = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
          const talk = turns.reduce((sum, turn) => sum + Math.max(0, Number(turn.end) - Number(turn.start)), 0);
          const share = maxTime > 0 ? Math.round((talk / maxTime) * 100) : 0;
          return (
            <div className="speaker-lane" key={speaker}>
              <div className="speaker-lane-label">
                <span className="speaker-dot" style={{ background: color }} aria-hidden="true" />
                <div>
                  <p>{speakerLabel(speaker)}</p>
                  <span className="mono">{pluralize(turns.length, 'turn')} · {formatDuration(talk)}</span>
                </div>
                <span className="speaker-share mono">{share}%</span>
              </div>
              <div className="speaker-track" role="list" aria-label={`${speakerLabel(speaker)} turns`}>
                {turns.map((turn, turnIndex) => {
                  const start = Math.max(0, Number(turn.start) || 0);
                  const end = Math.max(start, Number(turn.end) || start);
                  const left = (start / maxTime) * 100;
                  const width = Math.max(0.6, ((end - start) / maxTime) * 100);
                  return (
                    <span
                      key={`${speaker}-${start}-${turnIndex}`}
                      className="speaker-turn"
                      style={{ left: `${left}%`, width: `${width}%`, background: color }}
                      title={`${speakerLabel(speaker)} · ${formatDuration(start, true)}–${formatDuration(end, true)}`}
                      role="listitem"
                    >
                      <span className="sr-only">
                        {speakerLabel(speaker)} from {formatDuration(start)} to {formatDuration(end)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="speaker-axis" aria-hidden="true">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <span key={fraction} style={{ left: `${fraction * 100}%` }}>
            {formatDuration(maxTime * fraction)}
          </span>
        ))}
      </div>
      <p className="timeline-note">
        <Mic2 size={13} aria-hidden="true" /> Segment boundaries are returned by the diarization engine. Overlapping speech may be imperfect.
      </p>
    </div>
  );
}
