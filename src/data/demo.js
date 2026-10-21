import { uid, nowIso } from '../utils/helpers';
import { PPP_TEMPLATES } from '../constants/coaching';

// Sample data for the signed-out demo (see store.startDemo).

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

// A demo snapshot in the same shape GET /api/v2/snapshot returns.
export function buildDemoSnapshot() {
  const { team } = buildSampleTeam();
  return {
    coach: { defaultTeamId: team.id },
    teams: [{ ...team, games: [], sharing: { isShared: false }, archived: false }],
    library: { exercises: [], sessions: [] },
    hidden: { exercises: [], sessions: [] },
    diagrams: [],
  };
}

