const path = require('path');
const rules = require(path.resolve(__dirname, '../../Marralhinha/src/shared/rules.js'));

const KIND = { step: 0, enter: 1, enterCenter: 2, exitCenter: 3 };
let seed = 0;
const rnd = (n) => {
  seed = (seed * 25173 + 13849) & 0xffff;
  return (seed >> 8) % n;
};
const cell = (p) => (p.zone === 'base' ? 'b' : p.zone === 'center' ? 'c' : p.zone === 'home' ? `h${p.slot}` : `t${p.idx}`);
const dump = (st) => `${st.turn} ${st.phase === 'roll' ? 0 : st.phase === 'move' ? 1 : 2}|${st.marbles.map((ms) => ms.map((p) => cell(p) + ' ').join('')).join('')}`;

const out = [];
for (let g = 0; g < 6; g++) {
  seed = 1000 + g * 77;
  const seats = [0, 1, 2, 3].map((i) => ({ name: `P${i}` }));
  const st = rules.createGame(seats, { variant: 'blitz', starter: { seat: g & 3, reason: 'winner' } });
  out.push(`GAME ${g}`);
  let steps = 0;
  for (; steps < 900 && st.phase !== 'over'; steps++) {
    const die = 1 + rnd(6);
    rules.roll(st, () => die);
    const moves = st.legalMoves;
    out.push(`R${die} n${moves.length} ${moves.map((m) => `${m.marble}:${KIND[m.kind]}:${m.capture ? m.capture.seat : -1} `).join('')}${dump(st)}`);
    if (st.phase === 'move') {
      const i = rnd(moves.length);
      rules.move(st, moves[i].id);
      out.push(`M${i} ${dump(st)}`);
    }
  }
  out.push(`END ${st.winners ? st.winners[0] : -1} ${steps}`);
}
console.log(out.join('\n'));
