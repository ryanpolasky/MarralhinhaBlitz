dofile("test/harness.lua")

local GAME = sym("_game")
local schedule = { { f = 50, shot = "title" }, { f = 60, p = 1, press = "Start" }, { f = 130, p = 1, press = "Start" } }
for f = 300, 20000, 10 do table.insert(schedule, { f = f, p = 1, press = "A", len = 3 }) end

local over
run(schedule, function(frame)
  if frame > 290 and mem:read_u8(GAME) == 0 and mem:read_u8(GAME + 1) == 1 and mem:read_u8(GAME + 16) ~= 1 then
    mem:write_u8(GAME + 12, 3); mem:write_u8(GAME + 13, 1)
    mem:write_u8(GAME + 14, 3); mem:write_u8(GAME + 15, 2)
    mem:write_u8(GAME + 16, 1); mem:write_u8(GAME + 17, 9)
  end
  if frame < 300 then return end
  if mem:read_u8(GAME) == 2 and not over then over = frame; print("over at " .. frame) end
  if over and frame == over + 20 then shot("win_a") end
  if over and frame == over + 90 then shot("win_b") end
  if over and frame == over + 200 then shot("win_c"); manager.machine:exit() end
  if frame > 20000 then print("timeout"); manager.machine:exit() end
end)
