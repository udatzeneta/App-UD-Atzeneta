import re

file_path = "/Users/imac/Programas/App UD Atzeneta/src/services/data.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Helper function to append to data.ts
helper_fn = """
const applyCompetitiveLeaveEffects = async (injury: PlayerInjury) => {
  if (!injury.competitive_leave || injury.status === 'Recuperado') return;

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Trainings (Attendances)
    const trainings = await dataService.getTrainings();
    const futureTrainings = trainings.filter(t => t.date >= todayStr);
    
    if (isMockMode) {
      const allAttendances = MockDatabase.getTrainingAttendances();
      for (const t of futureTrainings) {
        let att = allAttendances.find(a => a.training_id === t.id && a.player_id === injury.player_id);
        if (att) {
          att.status = 'L';
          att.observations = `Baja competitiva: ${injury.diagnosis}`;
        } else {
          allAttendances.push({
            id: `att-${Date.now()}-${Math.random()}`,
            training_id: t.id,
            player_id: injury.player_id,
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
      MockDatabase.setTrainingAttendances(allAttendances);
    } else {
      for (const t of futureTrainings) {
        const { data: existing } = await supabase
          .from('training_attendances')
          .select('*')
          .eq('training_id', t.id)
          .eq('player_id', injury.player_id)
          .maybeSingle();

        if (existing) {
          await supabase.from('training_attendances').update({
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          }).eq('id', existing.id);
        } else {
          await supabase.from('training_attendances').insert({
            training_id: t.id,
            player_id: injury.player_id,
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
    }

    // 2. Matches (PlayerMatchStats)
    const matches = await dataService.getMatches();
    const futureMatches = matches.filter(m => m.date >= todayStr);

    if (isMockMode) {
      const allStats = MockDatabase.getPlayerMatchStats();
      for (const m of futureMatches) {
        let stat = allStats.find(s => s.match_id === m.id && s.player_id === injury.player_id);
        if (stat) {
          stat.is_called_up = false;
          stat.comments = `Baja competitiva: ${injury.diagnosis}`;
        } else {
          allStats.push({
            id: `stat-${Date.now()}-${Math.random()}`,
            match_id: m.id,
            player_id: injury.player_id,
            is_called_up: false,
            minutes_played: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_card: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
      MockDatabase.setPlayerMatchStats(allStats);
    } else {
      for (const m of futureMatches) {
        const { data: existing } = await supabase
          .from('player_match_stats')
          .select('*')
          .eq('match_id', m.id)
          .eq('player_id', injury.player_id)
          .maybeSingle();

        if (existing) {
          await supabase.from('player_match_stats').update({
            is_called_up: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          }).eq('id', existing.id);
        } else {
          await supabase.from('player_match_stats').insert({
            match_id: m.id,
            player_id: injury.player_id,
            is_called_up: false,
            minutes_played: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_card: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
    }
  } catch (err) {
    console.error("Error applying competitive leave effects", err);
  }
};
"""

# Now we need to modify the status check in mock mode to account for competitive_leave
# Old mock logic
# const hasBaja = remaining.some(x => x.status === 'Baja');
new_mock_baja = "const hasBaja = remaining.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));"
content = content.replace("const hasBaja = remaining.some(x => x.status === 'Baja');", new_mock_baja)

# Old real logic
# const hasBaja = remaining?.some(x => x.status === 'Baja');
new_real_baja = "const hasBaja = remaining?.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));"
content = content.replace("const hasBaja = remaining?.some(x => x.status === 'Baja');", new_real_baja)

# Old mock logic 2 updatePlayerInjury
# const hasBaja = remaining.some(x => x.status === 'Baja');
content = content.replace("const hasBaja = remaining?.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));", new_real_baja)

# Insert the helper fn after imports
content = content.replace("export const dataService = {", helper_fn + "\nexport const dataService = {")

# Call the helper inside createPlayerInjury
create_mock_end = "return newItem;\n    } else {"
new_create_mock_end = "applyCompetitiveLeaveEffects(newItem);\n      return newItem;\n    } else {"
content = content.replace(create_mock_end, new_create_mock_end)

create_real_end = "return data as PlayerInjury;\n    }\n  },"
new_create_real_end = "applyCompetitiveLeaveEffects(data as PlayerInjury);\n      return data as PlayerInjury;\n    }\n  },"
content = content.replace(create_real_end, new_create_real_end)

# Call the helper inside updatePlayerInjury
update_mock_end = "return list[idx];\n    } else {"
new_update_mock_end = "applyCompetitiveLeaveEffects(list[idx]);\n      return list[idx];\n    } else {"
content = content.replace(update_mock_end, new_update_mock_end)

update_real_end = "return data as PlayerInjury;\n    }\n  },"
new_update_real_end = "applyCompetitiveLeaveEffects(data as PlayerInjury);\n      return data as PlayerInjury;\n    }\n  },"
content = content.replace(update_real_end, new_update_real_end)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("data.ts patched successfully")
