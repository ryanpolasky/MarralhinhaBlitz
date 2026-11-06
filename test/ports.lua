local done = false
sub = emu.add_machine_frame_notifier(function()
  if done then return end
  done = true
  for tag, port in pairs(manager.machine.ioport.ports) do
    for name, field in pairs(port.fields) do
      print(tag .. " | " .. name)
    end
  end
  for tag, scr in pairs(manager.machine.screens) do print("screen " .. tag) end
  manager.machine:exit()
end)
