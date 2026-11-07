dofile("test/harness.lua")

local GAME = sym("_game")
local schedule = { { f = 60, p = 1, press = "Start" }, { f = 130, p = 1, press = "Start" } }
local poked
run(schedule, function(frame)
  if frame > 300 and not poked and mem:read_u8(GAME) == 0 and mem:read_u8(GAME + 1) == 1 then
    mem:write_u8(GAME + 12, 3); mem:write_u8(GAME + 13, 2)
    mem:write_u8(GAME + 14, 3); mem:write_u8(GAME + 15, 1)
    mem:write_u8(GAME + 16, 1); mem:write_u8(GAME + 17, 16)
    poked = frame
    print("poked at " .. frame)
  end
  if poked and not moved and mem:read_u8(GAME + 1) ~= 1 then moved = frame end
  if moved and frame == moved - 10 + 1 then end
  if poked and frame > poked and frame < poked + 320 and (frame - poked) % 8 == 0 then
    shot(string.format("i%04d", frame - poked))
  end
  if poked and (frame - poked) % 40 == 0 then
    local z = {}
    for k = 12, 17 do z[#z + 1] = mem:read_u8(GAME + k) end
    print(frame - poked, table.concat(z, ","), "turn", mem:read_u8(GAME + 1), "phase", mem:read_u8(GAME))
  end
  if poked and frame >= poked + 320 then manager.machine:exit() end
  if frame > 6000 then manager.machine:exit() end
end)
