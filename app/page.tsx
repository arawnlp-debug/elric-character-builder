"use client";

import { useState, useEffect } from 'react';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';

// --- TYPES ---
interface Characteristics {
  STR: number;
  CON: number;
  SIZ: number;
  DEX: number;
  INT: number;
  POW: number;
  CHA: number;
}

interface SkillSpend {
  culture: number;
  career: number;
  bonus: number;
}

const standardSkillKeys = [
  "Athletics", "Boating", "Brawn", "Conceal", "Customs", "Dance", 
  "Deceit", "Drive", "Endurance", "Evade", "FirstAid", "Influence", 
  "Insight", "Locale", "NativeTongue", "Perception", "Ride", "Sing", 
  "Stealth", "Swim", "Unarmed", "Willpower"
];

const getProfSkillBase = (skillName: string, chars: Characteristics) => {
  const name = skillName.toLowerCase();
  if (name.includes('art')) return chars.POW + chars.CHA;
  if (name.includes('commerce')) return chars.INT + chars.CHA;
  if (name.includes('courtesy')) return chars.INT + chars.CHA;
  if (name.includes('craft')) return chars.DEX + chars.INT;
  if (name.includes('language')) return chars.INT + chars.CHA;
  if (name.includes('streetwise')) return chars.POW + chars.CHA;
  if (name.includes('lore')) return chars.INT * 2;
  if (name.includes('navigation')) return chars.INT + chars.POW;
  if (name.includes('survival')) return chars.CON + chars.POW;
  if (name.includes('track')) return chars.INT + chars.CON;
  if (name.includes('binding')) return chars.POW + chars.CHA;
  if (name.includes('trance')) return chars.POW * 2;
  if (name.includes('healing')) return chars.INT + chars.POW;
  return chars.INT * 2; 
};

export default function CharacterBuilder() {
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [socialClass, setSocialClass] = useState({ name: "Freeman", multi: 1 });
  
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné" }]);
  const [dedicatedMPs, setDedicatedMPs] = useState(0);
  const [pactName, setPactName] = useState("");
  const [spells, setSpells] = useState<string[]>([]);
  const [gifts, setGifts] = useState<string[]>([]);
  const [inventory, setInventory] = useState("");
  
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});

  useEffect(() => {
    const cult = (culturesData as any[]).find(c => c.id === selectedCulture);
    if (cult?.forcedCareer) setSelectedCareer(cult.forcedCareer);
  }, [selectedCulture]);

  const rollSocialClass = () => {
    const roll = Math.floor(Math.random() * 100) + 1;
    const isM = selectedCulture === "melnibone";
    let res = roll <= 10 ? {name:"Outlaw", m:0.25} : roll <= 50 ? {name:"Poor", m:0.5} : roll <= 75 ? {name:"Freeman", m:1} : roll <= 95 ? {name:"Gentry", m:3} : {name:"Aristocracy", m:5};
    if (isM) res = roll <= 80 ? {name:"Gentry", m:5} : roll <= 98 ? {name:"Aristocracy", m:10} : {name:"Ruling", m:20};
    setSocialClass({ name: res.name, multi: res.m });
  };

  const handleStatChange = (s: keyof Characteristics, v: string) => {
    let val = parseInt(v) || 0;
    const min = (s === "INT" || s === "SIZ") ? 8 : 3;
    setCharacteristics(prev => ({ ...prev, [s]: Math.min(18, Math.max(min, val)) }));
  };

  const pointsSpent = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const hpB = Math.ceil((characteristics.CON + characteristics.SIZ) / 5);
  const maxMPs = characteristics.POW - dedicatedMPs;
  const passionBase = characteristics.POW + characteristics.CHA;

  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);
  const activeStyle = (stylesData as any[]).find(s => s.id === selectedStyle);
  
  const cultureProfs: string[] = activeCulture?.professionalSkills || [];
  const careerProfs: string[] = activeCareer?.professionalSkills || [];
  const careerStandards: string[] = activeCareer?.standardSkills || [];
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();

  const getStandardBase = (s: string) => {
    const c = characteristics;
    if (s === "Customs" || s === "NativeTongue") return (c.INT * 2) + (selectedCulture ? 40 : 0);
    if (["Athletics", "Unarmed"].includes(s)) return c.STR + c.DEX;
    if (["Boating", "Swim"].includes(s)) return c.STR + c.CON;
    if (s === "Brawn") return c.STR + c.SIZ;
    if (["Conceal", "Drive", "Ride"].includes(s)) return c.DEX + c.POW;
    if (["Dance", "Deceit"].includes(s)) return c.INT + c.CHA;
    if (s === "Endurance") return c.CON * 2;
    if (s === "Evade") return c.DEX * 2;
    if (s === "FirstAid") return c.INT + c.DEX;
    if (s === "Influence") return c.CHA * 2;
    if (["Insight", "Perception"].includes(s)) return c.INT + c.POW;
    if (s === "Locale") return c.INT * 2;
    if (s === "Sing") return c.CHA + c.POW;
    if (s === "Stealth") return c.DEX + c.INT;
    if (s === "Willpower") return c.POW * 2;
    return 0;
  };

  const highSpeechTotal = (characteristics.INT + characteristics.CHA) + (skillSpends["Language (High Speech)"]?.culture || 0) + (skillSpends["Language (High Speech)"]?.career || 0) + (skillSpends["Language (High Speech)"]?.bonus || 0);

  const handleSkillSpend = (skill: string, pool: keyof SkillSpend, value: string) => {
    setSkillSpends(prev => ({ 
        ...prev, 
        [skill]: { 
            ...(prev[skill] || { culture: 0, career: 0, bonus: 0 }), 
            [pool]: parseInt(value) 
        } 
    }));
  };

  const SkillRow = ({ name, base, type }: { name: string, base: number, type: string }) => {
    const spends = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    const total = base + (spends.culture || 0) + (spends.career || 0) + (spends.bonus || 0);
    const isMagic = ["Summoning Ritual", "Command", "Rune Casting"].includes(name);
    const overCap = isMagic && total > highSpeechTotal;

    const canC = type === "standard" || cultureProfs.includes(name) || type === "style";
    const canJ = careerStandards.includes(name) || careerProfs.includes(name) || type === "style";

    return (
      <tr className={`border-b text-[10px] ${overCap ? 'bg-red-50' : ''}`}>
        <td className={`p-1 font-bold ${overCap ? 'text-red-600' : ''}`}>{name}</td>
        <td className="text-center text-gray-500">{base}</td>
        {(['culture', 'career', 'bonus'] as const).map(p => {
          const isActive = p === 'culture' ? canC : p === 'career' ? canJ : true;
          const color = p === 'culture' ? 'blue' : p === 'career' ? 'green' : 'purple';
          return (
            <td key={p} className={`text-center bg-${color}-50`}>
              <select disabled={!isActive} className={`border text-[9px] ${!isActive ? 'opacity-20' : ''}`} value={spends[p]} onChange={e => handleSkillSpend(name, p, e.target.value)}>
                {[0, 5, 10, 15].map(v => <option key={v} value={v}>{v || '-'}</option>)}
              </select>
            </td>
          );
        })}
        <td className={`text-center font-bold ${overCap ? 'text-red-700 underline' : ''}`}>{total}%</td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-[#f4e4bc] p-4 font-serif text-sm text-black">
      <div className="max-w-7xl mx-auto bg-white p-6 border-4 border-black shadow-2xl">
        <h1 className="text-3xl font-bold text-center uppercase tracking-tighter border-b-2 border-black mb-6">Elric Character Creator (Mythras)</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <section className="space-y-4">
            <div className="border p-2 bg-gray-50">
              <h2 className="font-bold border-b mb-2">1. Identity</h2>
              <select className="w-full mb-2 border p-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)}>
                <option value="">Select Kingdom</option>
                {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
              </select>
              <select className="w-full border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)} disabled={!!activeCulture?.forcedCareer}>
                <option value="">Select Career</option>
                {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="border p-2 bg-blue-50 border-blue-200">
              <h2 className="font-bold border-b border-blue-300 mb-2 text-blue-900">2. Pact & Magic</h2>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold">Max Magic Points:</span>
                <span className="text-sm font-bold text-blue-700">{maxMPs}</span>
              </div>
              <input placeholder="Pact Name (e.g. Arioch)" className="w-full text-[10px] p-1 border mb-1" value={pactName} onChange={e => setPactName(e.target.value)} />
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[9px] font-bold">Dedicated MP:</label>
                <input type="number" className="w-10 border text-center text-xs" value={dedicatedMPs} onChange={e => setDedicatedMPs(parseInt(e.target.value) || 0)} />
              </div>
              
              <p className="text-[9px] font-bold text-blue-800 mb-1">Gifts & Compulsions:</p>
              {gifts.map((g, idx) => (
                <input key={idx} className="w-full text-[9px] border mb-0.5 p-0.5" value={g} onChange={e => {
                  const newG = [...gifts]; newG[idx] = e.target.value; setGifts(newG);
                }} />
              ))}
              <button onClick={() => setGifts([...gifts, ""])} className="text-[8px] bg-blue-800 text-white px-2 py-0.5">+ Add Gift</button>
            </div>

            <div className="border p-2 bg-red-50 border-red-200">
              <h2 className="font-bold border-b border-red-300 mb-2 text-red-900">3. Passions ({passionBase}%)</h2>
              {passions.map((p, idx) => (
                <div key={p.id} className="flex gap-1 mb-1">
                  <input className="text-[9px] border flex-1 p-0.5" placeholder="Hate Pan Tang..." value={p.target} onChange={e => {
                    const newP = [...passions]; newP[idx].target = e.target.value; setPassions(newP);
                  }} />
                  <button onClick={() => setPassions(passions.filter(x => x.id !== p.id))} className="text-red-500 font-bold px-1">×</button>
                </div>
              ))}
              <button onClick={() => setPassions([...passions, {id: Date.now(), target:""}])} className="text-[8px] bg-red-800 text-white px-2 py-0.5">+ Add Passion</button>
            </div>
          </section>

          <section className="space-y-4">
            <div className="border p-2">
              <h2 className="font-bold border-b mb-2">4. Characteristics ({pointsSpent}/80)</h2>
              <div className="grid grid-cols-2 gap-x-2">
                {(Object.keys(characteristics) as (keyof Characteristics)[]).map(s => (
                  <div key={s} className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold">{s}</label>
                    <input type="number" className="w-8 border text-center text-xs" value={characteristics[s]} onChange={e => handleStatChange(s, e.target.value)}/>
                  </div>
                ))}
              </div>
            </div>

            <div className="border p-2 bg-gray-50">
              <h2 className="font-bold border-b mb-1 text-xs">Hit Locations</h2>
              <table className="w-full text-center text-[10px] border">
                <thead><tr className="bg-gray-200"><th>1d20</th><th>Loc</th><th>HP</th></tr></thead>
                <tbody>
                {[{r:"19-20", l:"Head", h:hpB}, {r:"10-12", l:"Chest", h:hpB+2}, {r:"7-9", l:"Abdo", h:hpB+1}, {r:"13-18", l:"Arms", h:hpB}, {r:"1-6", l:"Legs", h:hpB}].map(row => (
                  <tr key={row.l} className="border-b"><td>{row.r}</td><td className="text-left font-bold">{row.l}</td><td>{row.h}</td></tr>
                ))}
                </tbody>
              </table>
            </div>

            <div className="border p-2 bg-yellow-50">
              <div className="flex justify-between items-center border-b mb-1">
                <h2 className="font-bold text-xs">5. Social Class</h2>
                <button onClick={rollSocialClass} className="text-[8px] bg-black text-white px-1">Roll</button>
              </div>
              <p className="text-[10px]"><strong>{socialClass.name}</strong> ({socialClass.multi * (activeCulture?.startingMoney.includes('150') ? 600 : 300)} SP)</p>
            </div>
          </section>

          <section className="col-span-1 border p-2 max-h-[750px] overflow-y-auto">
            <h2 className="font-bold border-b mb-2">6. Skills & Styles</h2>
            <select className="w-full border p-1 text-[9px] mb-2" value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}>
              <option value="">-- Choose Combat Style --</option>
              {(stylesData as any[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <table className="w-full">
              <thead className="bg-black text-white text-[9px]">
                <tr><th className="text-left p-1">Skill</th><th>B</th><th>C</th><th>J</th><th>B</th><th>F</th></tr>
              </thead>
              <tbody>
                {standardSkillKeys.map(s => <SkillRow key={s} name={s} base={getStandardBase(s)} type="standard" />)}
                {activeStyle && <SkillRow name={`Style: ${activeStyle.name}`} base={characteristics.STR + characteristics.DEX} type="style" />}
                {pactName && <SkillRow name={`Pact (${pactName})`} base={characteristics.CHA + dedicatedMPs} type="prof" />}
                <tr className="bg-gray-200 font-bold text-[9px] text-center border-y border-black">
                    <td colSpan={6}>Professional Skills</td>
                </tr>
                {availableProfSkills.map(s => <SkillRow key={s} name={s} base={getProfSkillBase(s, characteristics)} type="prof" />)}
              </tbody>
            </table>
          </section>

          <section className="space-y-4">
            <div className="border p-2 bg-purple-50 border-purple-200">
              <h2 className="font-bold border-b border-purple-300 mb-2 text-purple-900">7. Grimoire / Spells</h2>
              {spells.map((s, idx) => (
                <input key={idx} className="w-full text-[9px] border mb-0.5 p-0.5" placeholder="Spell/Rune name..." value={s} onChange={e => {
                  const newS = [...spells]; newS[idx] = e.target.value; setSpells(newS);
                }} />
              ))}
              <button onClick={() => setSpells([...spells, ""])} className="text-[8px] bg-purple-800 text-white px-2 py-0.5">+ Add Spell</button>
            </div>

            <div className="border p-2 bg-gray-50 flex-1 flex flex-col">
              <h2 className="font-bold border-b mb-2">8. Inventory & Gear</h2>
              <textarea 
                className="w-full flex-1 text-[10px] p-1 border min-h-[400px]" 
                placeholder="List your weapons, armor, and gear here..."
                value={inventory}
                onChange={e => setInventory(e.target.value)}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}