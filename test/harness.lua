local PORTS = {
  [1] = ":ctrl1:joypad:JOYPAD",
  [2] = ":ctrl2:joypad:JOYPAD",
  [3] = ":exp:hori_twin:subexp0:joypad:JOYPAD",
  [4] = ":exp:hori_twin:subexp1:joypad:JOYPAD",
}

function sym(name)
  for line in io.lines("build/blitz.map") do
    local a = line:match("^" .. name .. "%s+(%x+)") or line:match("%s" .. name .. "%s+(%x+)")
    if a then return tonumber(a, 16) end
  end
end

mem = manager.machine.devices[":maincpu"].spaces["program"]

function shot(name)
  manager.machine.screens[":screen"]:snapshot(name .. ".png")
end

function run(schedule, every)
  local frame = 0
  local held = {}
  local byFrame = {}
  for _, e in ipairs(schedule) do
    byFrame[e.f] = byFrame[e.f] or {}
    table.insert(byFrame[e.f], e)
  end
  sub = emu.add_machine_frame_notifier(function()
    frame = frame + 1
    for i = #held, 1, -1 do
      local h = held[i]
      if frame >= h.until_frame then
        h.field:set_value(0)
        table.remove(held, i)
      end
    end
    for _, e in ipairs(byFrame[frame] or {}) do
      if e.press then
        local field = manager.machine.ioport.ports[PORTS[e.p]].fields["P" .. e.p .. " " .. e.press]
        field:set_value(1)
        table.insert(held, { field = field, until_frame = frame + (e.len or 4) })
      end
      if e.shot then shot(e.shot) end
      if e.exit then manager.machine:exit() end
    end
    if every then every(frame) end
  end)
end
