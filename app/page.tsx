"use client";

import { useState, useEffect } from 'react';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';

// --- TYPES ---
interface Characteristics {
  STR: number; CON: number; SIZ: number; DEX: number; INT: number; POW: number; CHA: number;
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
  if (name.includes('commerce') || name.includes('courtesy') || name.includes('language')) return chars.INT + chars.CHA;
  if (name.includes('craft')) return chars.DEX + chars.INT;
  if (name.includes('streetwise') || name.includes('binding')) return chars.POW + chars.CHA;
  if (name.includes('lore') || name.includes('locale')) return chars.INT * 2;
  if (name.includes('navigation') || name.includes('healing')) return chars.INT + chars.POW;
  if (name.includes('survival') || name.includes('track')) return chars.CON + chars.POW;
  if (name.includes('trance')) return chars.POW * 2;
  return chars.INT * 2; 
};

export default function CharacterBuilder() {
  // --- STATE ---
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [socialClass, setSocialClass] = useState({ name: "Freeman", multi: 1 });
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné", val: 0 }]);
  const [dedicatedMPs, setDedicatedMPs] = useState(0);
  const [pactName, setPactName] = useState("");
  const [spells, setSpells] = useState<string[]>([]);
  const [inventory, setInventory] = useState("");
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});

  // --- DERIVED DATA ---
  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);
  const activeStyle = (stylesData as any[]).find(s => s.id === selectedStyle);

  const cultureProfs: string[] = activeCulture?.professionalSkills || [];
  const careerProfs: string[] = activeCareer?.professionalSkills || [];
  const careerStandards: string[] = activeCareer?.standardSkills || [];
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();

  // --- POOL CALCULATIONS ---
  const charPoints = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const cultureSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.culture || 0), 0);
  const careerSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.career || 0), 0);
  const bonusSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.bonus || 0), 0);

  const getStandardBase = (s: string) => {
    const c = characteristics;
    let base = 0;
    if (s === "Customs" || s === "NativeTongue") base = (c.INT * 2) + (selectedCulture ? 40 : 0);
    else if (["Athletics", "Unarmed"].includes(s)) base = c.STR + c.DEX;
    else if (["Boating", "Swim"].includes(s)) base = c.STR + c.CON;
    else if (s === "Brawn") base = c.STR + c.SIZ;
    else if (["Conceal", "Drive", "Ride"].includes(s)) base = c.DEX + c.POW;
    else if (["Dance", "Deceit"].includes(s)) base = c.INT + c.CHA;
    else if (s === "Endurance") base = c.CON * 2;
    else if (s === "Evade") base = c.DEX * 2;
    else if (s === "FirstAid") base = c.INT + c.DEX;
    else if (s === "Influence") base = c.CHA * 2;
    else if (["Insight", "Perception"].includes(s)) base = c.INT + c.POW;
    else if (s === "Locale") base = c.INT * 2;
    else if (s === "Sing") base = c.CHA + c.POW;
    else if (s === "Stealth") base = c.DEX + c.INT;
    else if (s === "Willpower") base = c.POW * 2;
    return base;
  };

  const highSpeechTotal = (characteristics.INT + characteristics.CHA) + 
    (skillSpends["Language (High Speech)"]?.culture || 0) + 
    (skillSpends["Language (High Speech)"]?.career || 0) + 
    (skillSpends["Language (High Speech)"]?.bonus || 0);

  // --- HANDLERS ---
  const handleSkillChange = (skill: string, pool: keyof SkillSpend, value: number) => {
    setSkillSpends(prev => ({
      ...prev,
      [skill]: { ...(prev[skill] || { culture: 0, career: 0, bonus: 0 }), [pool]: value }
    }));
  };

  const SkillRow = ({ name, base, type }: { name: string, base: number, type: string }) => {
    const s = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    const total = base + s.culture + s.career + s.bonus;
    const isMagic = ["Summoning Ritual", "Command", "Rune Casting"].includes(name);
    const overCap = isMagic && total > highSpeechTotal;

    const canCulture = type === "standard" || cultureProfs.includes(name) || type === "style";
    const canCareer = careerStandards.includes(name) || careerProfs.includes(name) || type === "style";

    return (
      <tr className={`border-b text-[10px] ${overCap ? 'bg-red-50' : ''}`}>
        <td className={`p-1 font-bold ${overCap ? 'text-red-600' : ''}`}>{name}</td>
        <td className="text-center text-gray-400">{base}</td>
        
        {/* Culture Pool (5-15) */}
        <td className="bg-blue-50">
          <input type="number" step="5" min="0" max="15" disabled={!canCulture}
            className={`w-8 text-center bg-transparent ${!canCulture ? 'opacity-10' : ''}`}
            value={s.culture} onChange={e => handleSkillChange(name, 'culture', parseInt(e.target.value) || 0)} />
        </td>

        {/* Career Pool (5-15) */}
        <td className="bg-green-50">
          <input type="number" step="5" min="0" max="15" disabled={!canCareer}
            className={`w-8 text-center bg-transparent ${!canCareer ? 'opacity-10' : ''}`}
            value={s.career} onChange={e => handleSkillChange(name, 'career', parseInt(e.target.value) || 0)} />
        </td>

        {/* Bonus Pool (Open) */}
        <td className="bg-purple-50">
          <input type="number" step="5" className="w-8 text-center bg-transparent"
            value={s.bonus} onChange={e => handleSkillChange(name, 'bonus', parseInt(e.target.value) || 0)} />
        </td>

        <td className={`text-center font-bold ${overCap ? 'text-red-700 underline' : ''}`}>{total}%</td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-[#ece0c8] p-4 font-serif text-black">
      <div className="max-w-7xl mx-auto bg-white border-4 border-black shadow-2xl p-6">
        <header className="border-b-4 border-black mb-6 pb-2 flex justify-between items-end">
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">Elric: Mythras</h1>
          <div className="text-right text-xs font-bold uppercase">
            Character Generation System v1.0
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* STEP 1 & 2: STATS */}
          <section className="space-y-6">
            <div className="border-2 border-black p-3">
              <h2 className="font-bold border-b-2 border-black mb-3 uppercase text-xs flex justify-between">
                Step 3: Characteristics <span className={charPoints > 80 ? 'text-red-600' : ''}>{charPoints}/80</span>
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(characteristics) as (keyof Characteristics)[]).map(key => (
                  <div key={key} className="flex justify-between items-center border-b border-dotted border-gray-400">
                    <span className="font-bold text-xs">{key}</span>
                    <input type="number" className="w-10 text-center font-bold" value={characteristics[key]} 
                      onChange={e => setCharacteristics({...characteristics, [key]: parseInt(e.target.value) || 0})} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-black p-3 bg-gray-100">
              <h2 className="font-bold border-b-2 border-black mb-2 uppercase text-xs">Step 4: Attributes</h2>
              <div className="text-[10px] space-y-1">
                <p className="flex justify-between"><span>Action Points:</span> <strong>{characteristics.DEX + characteristics.INT <= 24 ? 2 : 3}</strong></p>
                <p className="flex justify-between"><span>Hit Points (Head):</span> <strong>{Math.ceil((characteristics.CON + characteristics.SIZ) / 5)}</strong></p>
                <p className="flex justify-between text-blue-800"><span>Tenacity (POW):</span> <strong>{characteristics.POW}</strong></p>
                <p className="flex justify-between"><span>Magic Points:</span> <strong>{characteristics.POW - dedicatedMPs}</strong></p>
              </div>
            </div>
          </section>

          {/* STEP 3 & 4: CULTURE & CAREER */}
          <section className="space-y-6">
            <div className="border-2 border-black p-3 bg-blue-50">
              <h2 className="font-bold border-b-2 border-black mb-2 uppercase text-xs">Step 6: Homeland</h2>
              <select className="w-full text-xs border p-1 mb-2" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)}>
                <option value="">Choose Kingdom...</option>
                {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
              </select>
              <p className="text-[9px] italic">{activeCulture?.description}</p>
            </div>

            <div className="border-2 border-black p-3 bg-green-50">
              <h2 className="font-bold border-b-2 border-black mb-2 uppercase text-xs">Step 7: Career</h2>
              <select className="w-full text-xs border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
                <option value="">Choose Career...</option>
                {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            
            <div className="border-2 border-black p-3 bg-purple-50">
              <h2 className="font-bold border-b-2 border-black mb-2 uppercase text-xs">Step 10: Passions</h2>
              {passions.map((p, idx) => (
                <div key={p.id} className="flex gap-1 mb-1">
                  <input className="text-[10px] border flex-1 p-1" placeholder="Hate Melniboné..." value={p.target} 
                    onChange={e => { const n = [...passions]; n[idx].target = e.target.value; setPassions(n); }} />
                  <span className="text-[10px] font-bold p-1 bg-white border">{characteristics.POW + characteristics.CHA}%</span>
                </div>
              ))}
              <button onClick={() => setPassions([...passions, {id: Date.now(), target: "", val: 0}])} className="text-[8px] bg-black text-white w-full py-1 mt-2 uppercase">Add Passion</button>
            </div>
          </section>

          {/* SKILLS TABLE (COLUMNS 3 & 4) */}
          <section className="md:col-span-2 border-2 border-black overflow-hidden flex flex-col">
            <div className="bg-black text-white p-2 flex justify-around text-[10px] font-bold uppercase">
              <div className={cultureSpent > 100 ? 'text-red-400' : ''}>Culture: {cultureSpent}/100</div>
              <div className={careerSpent > 100 ? 'text-red-400' : ''}>Career: {careerSpent}/100</div>
              <div className={bonusSpent > 150 ? 'text-red-400' : ''}>Bonus: {bonusSpent}/150</div>
            </div>
            <div className="overflow-y-auto flex-1 p-2">
              <table className="w-full">
                <thead>
                  <tr className="text-[9px] uppercase border-b-2 border-black">
                    <th className="text-left p-1">Skill</th><th>Base</th><th className="bg-blue-100">Cult</th><th className="bg-green-100">Car</th><th className="bg-purple-100">Bon</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {standardSkillKeys.map(k => <SkillRow key={k} name={k} base={getStandardBase(k)} type="standard" />)}
                  <tr className="bg-gray-200 text-[9px] font-bold uppercase text-center"><td colSpan={6}>Professional Skills</td></tr>
                  {availableProfSkills.map(k => <SkillRow key={k} name={k} base={getProfSkillBase(k, characteristics)} type="prof" />)}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}