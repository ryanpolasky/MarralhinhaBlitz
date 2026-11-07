local frame = 0
local stop = tonumber(os.getenv("FRAMES") or "5400")
sub = emu.add_machine_frame_notifier(function()
  frame = frame + 1
  if frame >= stop then manager.machine:exit() end
end)
