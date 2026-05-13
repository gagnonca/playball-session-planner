import React, { useState } from 'react';
import playballIcon from '../assets/playball-icon.png';
import CreateTeamModal from './teams/CreateTeamModal';
import { HAS_SEEN_WELCOME_KEY } from '../constants/storage';
import { uid, nowIso } from '../utils/helpers';
import { PPP_TEMPLATES } from '../constants/coaching';

// First-run landing surface. Renders fullscreen (no NavRail) so a brand-new
// coach with zero teams isn't dropped into an empty Home. Matches section 8
// of the design handoff: pill badge, italic-accented headline, two CTAs,
// three-up benefit cards. Dismissal sets HAS_SEEN_WELCOME_KEY so this view
// won't fight Home once the user has a team.

function buildSampleTeam() {
  const teamId = uid();
  const sessionId = uid();
  const template = PPP_TEMPLATES['Attacking'] || Object.values(PPP_TEMPLATES)[0];

  const buildSection = (cfg) => ({
    id: uid(),
    name: cfg.name,
    type: cfg.type,
    time: cfg.time,
    objective: cfg.objective,
    organization: cfg.organization || '',
    guidedQA: cfg.guidedQA || '',
    notes: '',
    imageDataUrl: '',
    diagramData: null,
    variations: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return {
    teamId,
    sessionId,
    team: {
      id: teamId,
      name: 'Sample Team',
      ageGroup: 'U10',
      defaultDuration: '60',
      sessions: [{
        id: sessionId,
        summary: {
          title: 'Attacking — small-sided possession',
          date: '',
          duration: '60',
          ageGroup: 'U10',
          moment: 'Attacking',
          playerActions: ['Pass', 'Move'],
          keyQualities: ['Scan', 'Support'],
          notes: 'A starter session — feel free to edit anything.',
          keywords: '',
          reflectionNotes: '',
        },
        sections: [
          buildSection(template.play1),
          buildSection(template.practice),
          buildSection(template.play2),
        ],
        selectedSectionId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  };
}

function BenefitCard({ icon, title, body }) {
  return (
    <div
      className="rounded-[14px] p-5 text-left"
      style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
    >
      <div
        className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center mb-3"
        style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <div className="text-[15px] font-semibold mb-1" style={{ letterSpacing: '-0.015em' }}>{title}</div>
      <p className="text-[12.5px] leading-snug" style={{ color: 'var(--ink-2)' }}>{body}</p>
    </div>
  );
}

export default function Welcome({ teamsContext }) {
  const { navigateToTeams, navigateToSessionBuilder } = teamsContext;
  const [createOpen, setCreateOpen] = useState(false);

  const dismiss = () => {
    try { localStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true'); } catch { /* ignore */ }
  };

  const handleTrySample = () => {
    // Seed a sample team + session directly into useTeams' data layer.
    const { team } = buildSampleTeam();
    if (typeof teamsContext.createTeam !== 'function') {
      dismiss();
      navigateToTeams();
      return;
    }
    // createTeam(name, ageGroup) returns the new team; we then patch sessions in.
    const created = teamsContext.createTeam(team.name, team.ageGroup);
    if (created && teamsContext.updateTeam) {
      teamsContext.updateTeam(created.id, {
        ...created,
        defaultDuration: team.defaultDuration,
        sessions: team.sessions.map(s => ({ ...s, teamId: created.id })),
      });
      dismiss();
      const firstSession = team.sessions[0];
      if (firstSession && navigateToSessionBuilder) {
        navigateToSessionBuilder(created.id, firstSession.id);
        return;
      }
    }
    dismiss();
    navigateToTeams();
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <main className="max-w-[760px] mx-auto px-6 pt-20 pb-16">
        {/* Brand pill */}
        <div
          className="inline-flex items-center gap-2.5 rounded-full pl-1.5 pr-3.5 py-1"
          style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)' }}
        >
          <img src={playballIcon} alt="" className="w-6 h-6 rounded-[7px]" />
          <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>PlayBall</strong>
            <span style={{ color: 'var(--ink-3)' }}> · session planner for grassroots coaches</span>
          </span>
        </div>

        {/* Headline */}
        <h1
          className="mt-7 text-[52px] leading-[1.04] font-semibold"
          style={{ letterSpacing: '-0.025em' }}
        >
          Plan a practice your players will{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 600 }}>love</span>.
        </h1>

        <p
          className="mt-5 text-[16px] leading-snug max-w-[560px]"
          style={{ color: 'var(--ink-2)' }}
        >
          Build sessions, draw the field, and keep your team organized. Works offline by default —
          no account, no tracking. Turn on cloud sync only when you want it.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setCreateOpen(true)}
            className="btn btn-primary"
            style={{ padding: '12px 22px', fontSize: 15 }}
          >
            Create my first team
          </button>
          <button
            onClick={handleTrySample}
            className="btn btn-ghost"
            style={{ padding: '12px 18px', fontSize: 14 }}
          >
            Try a sample session
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { dismiss(); navigateToTeams(); }}
            className="btn btn-ghost"
            style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-3)' }}
            title="Skip this and explore the app empty"
          >
            Skip
          </button>
        </div>

        {/* Benefits */}
        <div
          className="mt-12 grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          <BenefitCard
            title="Free, forever"
            body="No paywall, no premium tier. Built for parent and volunteer coaches."
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
              </svg>
            }
          />
          <BenefitCard
            title="Yours by default"
            body="Sessions, diagrams, reflections — every keystroke lives on your device until you turn on sync."
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            }
          />
          <BenefitCard
            title="No tracking"
            body="No analytics, no email collection, no third-party ad SDKs. We never see who you are."
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9l6 6m0-6l-6 6" />
              </svg>
            }
          />
        </div>

        <p className="mt-10 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          You can come back to this screen any time from the rail&rsquo;s About button.
        </p>
      </main>

      {createOpen && (
        <CreateTeamModal
          teamsContext={teamsContext}
          onClose={() => {
            setCreateOpen(false);
            dismiss();
          }}
        />
      )}
    </div>
  );
}
