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

const backgroundEvents = [
  "Survived a pirate raid on a merchant cog.",
  "Witnessed a summoning that went horribly wrong.",
  "Exiled from home due to a forbidden romance.",
  "Recovered a minor relic of a forgotten Sorcerer-King.",
  "Debt-bound to a Pan Tangian merchant prince.",
  "Family vanished during a chaotic storm at sea.",
  "Served as a galley slave in the southern ports.",
  "Spared by a Myyrrhn hunter for reasons unknown.",
  "Found an ancient coin from the time of the Dharzi."
];

export default function CharacterBuilder() {
  // --- STATE ---
  const [name, setName] = useState("");
  const [race, setRace] = useState("Human");
  const [alignment, setAlignment] = useState("Neutral");
  const [age, setAge] = useState(18);
  const [background, setBackground] = useState("Roll for a Background Event...");
  
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [socialClass, setSocialClass] = useState({ name: "Freeman", multi: 1 });
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné", val: 0 }]);
  const [dedicatedMPs, setDedicatedMPs] = useState(0);
  const [pactName, setPactName] = useState("");
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});

  // --- DERIVED DATA ---
  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);
  const activeStyle = (stylesData as any[]).find(s => s.id === selectedStyle);

  const cultureProfs: string[] = activeCulture?.professionalSkills || [];
  const careerProfs: string[] = activeCareer?.professionalSkills || [];
  const careerStandards: string[] = activeCareer?.standardSkills || [];
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();

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
        <td className="bg-blue-50 text-center">
            <input type="number" step={5} className="w-8 text-center bg-transparent" disabled={!canCulture} value={s.culture} onChange={e => handleSkillChange(name, 'culture', parseInt(e.target.value) || 0)} />
        </td>
        <td className="bg-green-50 text-center">
            <input type="number" step={5} className="w-8 text-center bg-transparent" disabled={!canCareer} value={s.career} onChange={e => handleSkillChange(name, 'career', parseInt(e.target.value) || 0)} />
        </td>
        <td className="bg-purple-50 text-center">
            <input type="number" step={5} className="w-8 text-center bg-transparent" value={s.bonus} onChange={e => handleSkillChange(name, 'bonus', parseInt(e.target.value) || 0)} />
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
          <div className="text-right text-[10px] font-bold uppercase">Character Generation v1.2</div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* COLUMN 1: IDENTITY, BACKGROUND, AGE, HOMELAND */}
          <section className="space-y-4">
            <div className="border-2 border-black p-2 bg-gray-50">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px]">Step 1: Identity & Step 5: Age</h2>
              <input placeholder="Character Name" className="w-full text-xs border p-1 mb-1" value={name} onChange={e => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-1">
                <select className="text-xs border p-1" value={race} onChange={e => setRace(e.target.value)}>
                    <option>Human</option><option>Melnibonéan</option><option>Myyrrhn</option>
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-bold">AGE:</span>
                  <input type="number" className="text-xs border p-1 w-full" value={age} onChange={e => setAge(parseInt(e.target.value) || 18)} />
                </div>
              </div>
            </div>

            <div className="border-2 border-black p-2 bg-yellow-50">
              <h2 className="font-bold border-b border-black mb-1 uppercase text-[10px] flex justify-between">
                Step 2: Background Event <button onClick={() => setBackground(backgroundEvents[Math.floor(Math.random()*backgroundEvents.length)])} className="bg-black text-white px-1 text-[8px]">Roll</button>
              </h2>
              <p className="text-[10px] italic leading-tight min-h-[40px]">{background}</p>
            </div>

            <div className="border-2 border-black p-2 bg-blue-50">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px]">Step 6: Homeland</h2>
              <select className="w-full text-xs border p-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)}>
                <option value="">Choose Kingdom...</option>
                {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
              </select>
              {activeCulture && <p className="text-[9px] mt-1 leading-tight italic">{activeCulture.description}</p>}
            </div>
            
            <div className="border-2 border-black p-2 bg-green-50">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px]">Step 7: Career</h2>
              <select className="w-full text-xs border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)}>
                <option value="">Choose Career...</option>
                {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </section>

          {/* COLUMN 2: CHARACTERISTICS & ATTRIBUTES */}
          <section className="space-y-4">
            <div className="border-2 border-black p-2">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px] flex justify-between">
                Step 3: Characteristics <span className={charPoints > 80 ? 'text-red-600 font-bold' : ''}>{charPoints}/80</span>
              </h2>
              <div className="grid grid-cols-2 gap-x-4">
                {(Object.keys(characteristics) as (keyof Characteristics)[]).map(k => (
                  <div key={k} className="flex justify-between items-center text-xs mb-1 border-b border-dotted border-gray-400">
                    <span className="font-bold">{k}</span>
                    <input type="number" className="w-8 border-none text-center bg-transparent font-bold" value={characteristics[k]} onChange={e => setCharacteristics({...characteristics, [k]: parseInt(e.target.value) || 0})} />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-black p-2 bg-gray-100">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px]">Step 4: Attributes</h2>
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between border-b border-gray-300"><span>Action Points:</span> <strong>{characteristics.DEX + characteristics.INT <= 24 ? 2 : 3}</strong></div>
                <div className="flex justify-between border-b border-gray-300"><span>Hit Points (Head):</span> <strong>{Math.ceil((characteristics.CON + characteristics.SIZ) / 5)}</strong></div>
                <div className="flex justify-between border-b border-gray-300 text-blue-700 font-bold"><span>Tenacity (POW):</span> <strong>{characteristics.POW}</strong></div>
                <div className="flex justify-between"><span>Magic Points:</span> <strong>{characteristics.POW - dedicatedMPs}</strong></div>
              </div>
            </div>

            <div className="border-2 border-black p-2 bg-purple-50">
              <h2 className="font-bold border-b border-black mb-2 uppercase text-[10px]">Step 10: Passions</h2>
              {passions.map((p, idx) => (
                <div key={p.id} className="flex gap-1 mb-1 items-center">
                  <input className="text-[10px] border flex-1 p-1 bg-white" placeholder="Love / Hate..." value={p.target} 
                    onChange={e => { const n = [...passions]; n[idx].target = e.target.value; setPassions(n); }} />
                  <span className="text-[10px] font-bold p-1 bg-white border min-w-[35px] text-center">{characteristics.POW + characteristics.CHA}%</span>
                  <button onClick={() => setPassions(passions.filter(x => x.id !== p.id))} className="text-red-600 font-bold text-xs">×</button>
                </div>
              ))}
              <button onClick={() => setPassions([...passions, {id: Date.now(), target: "", val: 0}])} className="text-[8px] bg-black text-white w-full py-1 mt-1 uppercase">Add Passion</button>
            </div>
          </section>

          {/* COLUMN 3 & 4: SKILL POOLS & TABLE */}
          <section className="md:col-span-2 border-2 border-black flex flex-col">
            <div className="bg-black text-white p-1 flex justify-around text-[9px] font-bold uppercase">
              <div className={cultureSpent > 100 ? 'text-red-400' : ''}>Step 6-8 Cult: {cultureSpent}/100</div>
              <div className={careerSpent > 100 ? 'text-red-400' : ''}>Step 7-8 Car: {careerSpent}/100</div>
              <div className={bonusSpent > 150 ? 'text-red-400' : ''}>Step 9 Bonus: {bonusSpent}/150</div>
            </div>
            <div className="overflow-y-auto max-h-[700px] p-2">
              <table className="w-full">
                <thead className="text-[9px] uppercase border-b border-black">
                  <tr><th className="text-left">Skill</th><th>Base</th><th className="bg-blue-100">C</th><th className="bg-green-100">J</th><th className="bg-purple-100">B</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {standardSkillKeys.map(k => <SkillRow key={k} name={k} base={getStandardBase(k)} type="standard" />)}
                  <tr className="bg-gray-200 text-[9px] font-bold text-center uppercase"><td colSpan={6}>Professional Skills</td></tr>
                  {availableProfSkills.map(k => <SkillRow key={k} name={k} base={getProfSkillBase(k, characteristics)} type="prof" />)}
                </tbody>
              </table>
            </div>
            <div className="p-1 border-t border-black bg-gray-50 text-[8px] italic text-center">
              Sorcery Check: Magic skills cannot exceed High Speech total ({highSpeechTotal}%).
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}