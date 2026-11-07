dofile("test/harness.lua")
local A = tonumber(os.getenv("M_START") or "100")
local N = tonumber(os.getenv("M_COUNT") or "40")
local STEP = tonumber(os.getenv("M_STEP") or "2")
run({}, function(frame)
  if frame >= A and frame < A + N * STEP and (frame - A) % STEP == 0 then shot(string.format("m%04d", frame)) end
  if frame >= A + N * STEP then manager.machine:exit() end
end)
