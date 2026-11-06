dofile("test/harness.lua")
run({
  { f = 60, p = 1, press = "Start" },
  { f = 130, p = 3, press = "A" },
  { f = 160, p = 1, press = "Start" },
  { f = 300, p = 1, press = "A" },
  { f = 400, p = 1, press = "A" },
  { f = 600, exit = true },
})
