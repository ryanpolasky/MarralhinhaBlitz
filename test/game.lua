dofile("test/harness.lua")

local GAME = sym("_game")
local schedule = { { f = 60, p = 1, press = "Start" }, { f = 130, p = 1, press = "Start" } }
for f = 200, 40000, 10 do table.insert(schedule, { f = f, p = 1, press = "A", len = 3 }) end
for f = 400, 40000, 1500 do table.insert(schedule, { f = f, shot = string.format("g%05d", f) }) end

local over, rolls, lastDie = nil, 0, nil
run(schedule, function(frame)
  if frame < 200 then return end
  local phase = mem:read_u8(GAME)
  if phase == 2 and not over then
    over = frame
    print(string.format("GAME OVER at frame %d (%.1f min) winner=%d", frame, frame / 3600, mem:read_u8(GAME + 4)))
  end
  if over and frame == over + 60 then shot("win") end
  if over and frame == over + 200 then shot("win2") end
  if over and frame == over + 700 then shot("after_win"); manager.machine:exit() end
  if frame > 40000 then print("TIMEOUT phase=" .. phase); manager.machine:exit() end
end)
