local presses = {
  { f = 60, port = ":ctrl1:4score_p1p3:PAD1", field = "P1 Start" },
  { f = 140, port = ":ctrl2:4score_p2p4:PAD2", field = "A" },
  { f = 150, port = ":ctrl1:4score_p1p3:PAD3", field = "A" },
  { f = 160, port = ":ctrl2:4score_p2p4:PAD4", field = "A" },
}
local frame, held = 0, {}
sub = emu.add_machine_frame_notifier(function()
  frame = frame + 1
  for i = #held, 1, -1 do
    if frame >= held[i].t then held[i].field:set_value(0); table.remove(held, i) end
  end
  for _, p in ipairs(presses) do
    if p.f == frame then
      local field = manager.machine.ioport.ports[p.port].fields[p.field]
      field:set_value(1)
      table.insert(held, { field = field, t = frame + 4 })
    end
  end
  if frame == 200 then manager.machine.screens[":screen"]:snapshot("fourscore.png") end
  if frame == 201 then manager.machine:exit() end
end)
