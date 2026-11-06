dofile("test/harness.lua")
run({
  { f = 60, shot = "01_title" },
  { f = 100, p = 1, press = "Start" },
  { f = 160, shot = "02_join" },
  { f = 170, p = 3, press = "A" },
  { f = 200, p = 1, press = "Start" },
  { f = 230, shot = "03_intro" },
  { f = 330, shot = "04_turn" },
  { f = 600, shot = "05_mid" },
  { f = 900, shot = "06_mid" },
  { f = 1500, shot = "07_late" },
  { f = 1510, exit = true },
})
