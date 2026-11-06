dofile("test/harness.lua")

local GAME = sym("_game")
local HUMAN = { [0] = 1, [1] = 2, [3] = 4 }
local PORTS = { [1] = ":ctrl1:joypad:JOYPAD", [2] = ":ctrl2:joypad:JOYPAD", [4] = ":exp:hori_twin:subexp1:joypad:JOYPAD" }
local schedule = {
  { f = 110, shot = "title" },
  { f = 130, p = 1, press = "Start" },
  { f = 210, p = 2, press = "A" },
  { f = 225, p = 4, press = "A" },
  { f = 290, shot = "join" },
  { f = 300, p = 1, press = "Start" },
}

local cursorShots, holdUntil, held = 0, 0, nil
run(schedule, function(frame)
  if held and frame >= held.t then held.field:set_value(0); held = nil end
  if frame < 400 then return end
  if frame % 900 == 0 then shot(string.format("play_%05d", frame)) end
  local phase, turn, n = mem:read_u8(GAME), mem:read_u8(GAME + 1), mem:read_u8(GAME + 5)
  local pad = HUMAN[turn]
  if phase == 1 and turn == 0 and n >= 2 and cursorShots < 3 and frame > 1500 then
    if holdUntil == 0 then holdUntil = frame + 30 end
    if frame < holdUntil then return end
    cursorShots = cursorShots + 1
    shot("pick_" .. cursorShots)
    holdUntil = 0
  end
  if pad and not held and frame % 12 == 0 then
    local field = manager.machine.ioport.ports[PORTS[pad]].fields["P" .. pad .. " A"]
    field:set_value(1)
    held = { field = field, t = frame + 3 }
  end
  if frame > 9000 then manager.machine:exit() end
end)
