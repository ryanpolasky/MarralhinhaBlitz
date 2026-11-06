dofile("test/harness.lua")

local TICK = sym("_tick")
local schedule = { { f = 60, p = 1, press = "Start" }, { f = 130, p = 1, press = "Start" } }
for f = 200, 8000, 10 do table.insert(schedule, { f = f, p = 1, press = "A", len = 3 }) end

local last, lagged, total, worst, run_len = nil, 0, 0, 0, 0
run(schedule, function(frame)
  if frame < 200 then return end
  local t = mem:read_u8(TICK)
  if last then
    total = total + 1
    if t == last then
      lagged = lagged + 1
      run_len = run_len + 1
      if run_len > worst then worst = run_len end
    else
      run_len = 0
    end
  end
  last = t
  if frame == 8000 then
    print(string.format("frames=%d lagged=%d (%.1f%%) worst_streak=%d", total, lagged, 100 * lagged / total, worst))
    manager.machine:exit()
  end
end)
