dofile("test/harness.lua")

local START = tonumber(os.getenv("LAG_START") or "300")
local STOP = tonumber(os.getenv("LAG_STOP") or "500")
local schedule = {}
if os.getenv("LAG_PLAY") then
  schedule = { { f = 60, p = 1, press = "Start" }, { f = 130, p = 1, press = "Start" } }
  for f = 200, STOP, 10 do table.insert(schedule, { f = f, p = 1, press = "A", len = 3 }) end
end

local frame, dma = 0, 0
tap = mem:install_write_tap(0x4014, 0x4014, "dma", function() if frame > START and frame <= STOP then dma = dma + 1 end end)
run(schedule, function(f)
  frame = f
  if f == STOP then
    print(string.format("game loops (OAM DMAs) %d in %d frames", dma, STOP - START))
    manager.machine:exit()
  end
end)
