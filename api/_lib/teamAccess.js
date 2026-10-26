import { supabase } from './supabase.js';

// Who may do what with a team.
//
//   owner     — teams.coach_id is the caller's coach. Everything.
//   cocoach   — team_members row. Reads the team; creates, edits and
//               deletes the team's games. Not the roster, settings or members.
//   assistant — team_members row. Reads the team; may only keep private
//               copies of games (rows under their own coach_id).
//
// Returns { role, team } or null when the caller has no access (or the team
// is gone). `team` is the live row, so callers know the owner's coach_id.
export async function teamAccess(teamId, auth) {
  const { data: team, error } = await supabase
    .from('teams').select('*')
    .eq('id', teamId).is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!team) return null;
  if (team.coach_id === auth.coachId) return { role: 'owner', team };

  // Membership is per account; a legacy device link is never a member.
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data: member, error: memberErr } = await supabase
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', userId)
    .maybeSingle();
  if (memberErr) throw memberErr;
  return member ? { role: member.role, team } : null;
}

// Where a game write lands. Shared games live under the owner's coach_id so
// everyone on the team sees them; a private copy lives under the caller's
// own coach_id, where only they see it. Returns null when the role may not
// write a shared game.
export function gameOwnerFor(access, auth, { isPrivate }) {
  if (isPrivate) return auth.coachId;
  if (access.role === 'owner' || access.role === 'cocoach') return access.team.coach_id;
  return null;
}

// Teams the caller is a member of (not owner), with their role.
export async function memberTeams(auth) {
  const userId = auth.user?.id;
  if (!userId) return [];
  const { data: rows, error } = await supabase
    .from('team_members').select('team_id, role').eq('user_id', userId);
  if (error) throw error;
  if (!rows.length) return [];
  const roleById = new Map(rows.map(r => [r.team_id, r.role]));
  const { data: teams, error: teamsErr } = await supabase
    .from('teams').select('*')
    .in('id', [...roleById.keys()]).is('deleted_at', null);
  if (teamsErr) throw teamsErr;
  return teams.map(team => ({ team, role: roleById.get(team.id) }));
}

// The name to show for a coach ("Managed by …"): their PlayBall name, else
// their sign-in name, else nothing (callers fall back to "another coach").
// Never the email — this is shown to people holding an old share code.
export async function coachName(coachId) {
  const { data: coach } = await supabase
    .from('coaches').select('display_name, user_id').eq('coach_id', coachId).maybeSingle();
  if (!coach) return null;
  if (coach.display_name) return coach.display_name;
  if (!coach.user_id) return null;
  const { data } = await supabase.auth.admin.getUserById(coach.user_id);
  return data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || null;
}

