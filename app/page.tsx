"use client";

import { useState, useEffect } from 'react';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';

// --- DATA & LOOKUPS ---
const standardSkillKeys = [
  "Athletics", "Boating", "Brawn", "Conceal", "Customs", "Dance", 
  "Deceit", "Drive", "Endurance", "Evade", "FirstAid", "Influence", 
  "Insight", "Locale", "NativeTongue", "Perception", "Ride", "Sing", 
  "Stealth", "Swim", "Unarmed", "Willpower"
];

const getProfSkillBase = (skillName, chars) => {
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
  // --- 1. STATE ---
  const [characteristics, setCharacteristics] = useState({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [socialClass, setSocialClass] = useState({ name: "Freeman", multi: 1 });
  const [skillSpends, setSkillSpends] = useState({});

  // --- 2. AUTOMATIONS & EFFECTS ---
  useEffect(() => {
    const cult = culturesData.find(c => c.id === selectedCulture);
    if (cult?.forcedCareer) setSelectedCareer(cult.forcedCareer);
  }, [selectedCulture]);

  const rollSocialClass = () => {
    const roll = Math.floor(Math.random() * 100) + 1;
    const isMelnibonean = selectedCulture === "melnibone";
    let result = { name: "Freeman", multi: 1 };
    if (isMelnibonean) {
      if (roll <= 80) result = { name: "Gentry", multi: 5 };
      else if (roll <= 98) result = { name: "Aristocracy", multi: 10 };
      else result = { name: "Ruling", multi: 20 };
    } else {
      if (roll <= 10) result = { name: "Outlaw", multi: 0.25 };
      else if (roll <= 25) result = { name: "Slave/Poor", multi: 0.5 };
      else if (roll <= 50) result = { name: "Poor", multi: 0.5 };
      else if (roll <= 75) result = { name: "Freeman", multi: 1 };
      else if (roll <= 95) result = { name: "Gentry", multi: 3 };
      else if (roll <= 99) result = { name: "Aristocracy", multi: 5 };
      else result = { name: "Ruling", multi: 10 };
    }
    setSocialClass(result);
  };

  // --- 3. MATH & DERIVED ATTRIBUTES ---
  const handleStatChange = (stat, value) => {
    let val = parseInt(value) || 0;
    const min = (stat === "INT" || stat === "SIZ") ? 8 : 3;
    if (val < min) val = min;
    if (val > 18) val = 18;
    setCharacteristics(prev => ({ ...prev, [stat]: val }));
  };

  const pointsSpent = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const actionPoints = Math.ceil((characteristics.INT + characteristics.DEX) / 12);
  const initiativeBonus = Math.ceil((characteristics.INT + characteristics.DEX) / 2);
  const healingRate = characteristics.CON <= 6 ? 1 : characteristics.CON <= 12 ? 2 : characteristics.CON <= 18 ? 3 : 4;
  const expModifier = characteristics.CHA <= 6 ? -1 : characteristics.CHA <= 12 ? 0 : characteristics.CHA <= 18 ? 1 : 2;
  const dmgMod = (characteristics.STR + characteristics.SIZ) <= 15 ? "-1D4" : (characteristics.STR + characteristics.SIZ) <= 20 ? "-1D2" : (characteristics.STR + characteristics.SIZ) <= 25 ? "+0" : "+1D2";
  const hpB = Math.ceil((characteristics.CON + characteristics.SIZ) / 5);

  // --- 4. SKILL CALCULATIONS ---
  const activeCulture = culturesData.find(c => c.id === selectedCulture);
  const activeCareer = careersData.find(c => c.id === selectedCareer);
  const activeStyle = stylesData.find(s => s.id === selectedStyle);

  const cultureProfs = activeCulture?.professionalSkills || [];
  const careerProfs = activeCareer?.professionalSkills || [];
  const careerStandards = activeCareer?.standardSkills || [];
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();

  const getStandardBase = (s) => {
    const c = characteristics;
    switch(s) {
      case "Athletics": return c.STR + c.DEX;
      case "Boating": return c.STR + c.CON;
      case "Brawn": return c.STR + c.SIZ;
      case "Conceal": return c.DEX + c.POW;
      case "Customs": return (c.INT * 2) + (selectedCulture ? 40 : 0);
      case "Dance": return c.DEX + c.CHA;
      case "Deceit": return c.INT + c.CHA;
      case "Drive": return c.DEX + c.POW;
      case "Endurance": return c.CON * 2;
      case "Evade": return c.DEX * 2;
      case "FirstAid": return c.INT + c.DEX;
      case "Influence": return c.CHA * 2;
      case "Insight": return c.INT + c.POW;
      case "Locale": return c.INT * 2;
      case "NativeTongue": return c.INT + c.CHA + (selectedCulture ? 40 : 0);
      case "Perception": return c.INT + c.POW;
      case "Ride": return c.DEX + c.POW;
      case "Sing": return c.CHA + c.POW;
      case "Stealth": return c.DEX + c.INT;
      case "Swim": return c.STR + c.CON;
      case "Unarmed": return c.STR + c.DEX;
      case "Willpower": return c.POW * 2;
      default: return 0;
    }
  };

  const highSpeechTotal = (characteristics.INT + characteristics.CHA) + (skillSpends["Language (High Speech)"]?.culture || 0) + (skillSpends["Language (High Speech)"]?.career || 0) + (skillSpends["Language (High Speech)"]?.bonus || 0);

  const calcPoolTotal = (pool) => Object.values(skillSpends).reduce((t, s) => t + (s[pool] || 0), 0);
  const cultureRem = 100 - calcPoolTotal('culture');
  const careerRem = 100 - calcPoolTotal('career');
  const bonusRem = 150 - calcPoolTotal('bonus');

  const handleSkillSpend = (skill, pool, value) => {
    setSkillSpends(prev => ({ ...prev, [skill]: { ...(prev[skill] || { culture: 0, career: 0, bonus: 0 }), [pool]: parseInt(value) } }));
  };

  const SkillRow = ({ name, base, type }) => {
    const spends = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    const total = base + (spends.culture || 0) + (spends.career || 0) + (spends.bonus || 0);
    const isMagic = ["Summoning Ritual", "Command", "Rune Casting"].includes(name);
    const overCap = isMagic && total > highSpeechTotal;

    const canCulture = type === "standard" || cultureProfs.includes(name) || type === "style";
    const canCareer = careerStandards.includes(name) || careerProfs.includes(name) || type === "style";

    return (
      <tr className={`border-b text-[10px] ${overCap ? 'bg-red-50' : ''}`}>
        <td className={`p-1 font-bold ${overCap ? 'text-red-600' : ''}`}>{name}</td>
        <td className="text-center text-gray-500">{base}</td>
        {[{p:'culture', a:canCulture, c:'blue'}, {p:'career', a:canCareer, c:'green'}, {p:'bonus', a:true, c:'purple'}].map(col => (
          <td key={col.p} className={`text-center bg-${col.c}-50`}>
            <select disabled={!col.a} className={`border text-[9px] ${!col.a ? 'opacity-20' : ''}`} value={spends[col.p]} onChange={e => handleSkillSpend(name, col.p, e.target.value)}>
              {[0, 5, 10, 15].map(v => <option key={v} value={v}>{v || '-'}</option>)}
            </select>
          </td>
        ))}
        <td className={`text-center font-bold ${overCap ? 'text-red-700 underline' : ''}`}>{total}%</td>
      </tr>
    );
  };

  return (
    <main className="min-h-screen bg-[#f4e4bc] p-4 font-serif text-sm text-black">
      <div className="max-w-6xl mx-auto bg-white p-6 border-4 border-black shadow-2xl">
        <h1 className="text-3xl font-bold text-center uppercase tracking-tighter border-b-2 border-black mb-6">Elric Character Creator (Mythras)</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* COLUMN 1 */}
          <section className="space-y-4">
            <div className="border p-2 bg-gray-50">
              <h2 className="font-bold border-b mb-2">1. Homeland & Career</h2>
              <select className="w-full mb-2 border p-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)}>
                <option value="">Select Kingdom</option>
                {culturesData.map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
              </select>
              <select className="w-full border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)} disabled={activeCulture?.forcedCareer}>
                <option value="">Select Career</option>
                {careersData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="border p-2 bg-gray-50">
              <h2 className="font-bold border-b mb-2">2. Combat Style</h2>
              <select className="w-full border p-1 mb-1" value={selectedStyle} onChange={e => setSelectedStyle(e.target.value)}>
                <option value="">Select Style</option>
                {stylesData.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {activeStyle && <p className="text-[10px] italic">Wpns: {activeStyle.weapons} | Trait: {activeStyle.trait}</p>}
            </div>

            <div className="border p-2 bg-gray-50">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold border-b">3. Social Class</h2>
                <button onClick={rollSocialClass} className="bg-black text-white text-[10px] px-2 py-0.5 rounded">Roll Class</button>
              </div>
              <p className="text-xs">Class: <strong>{socialClass.name}</strong></p>
              <p className="text-xs">Starting Money: <strong>{Math.floor(socialClass.multi * (activeCulture?.startingMoney.includes('150') ? 600 : 300))} SP</strong></p>
            </div>
          </section>

          {/* COLUMN 2 */}
          <section className="space-y-4">
            <div className="border p-2">
              <h2 className="font-bold border-b mb-2">Characteristics (Spent: {pointsSpent}/80)</h2>
              <div className="grid grid-cols-2 gap-x-4">
                {Object.keys(characteristics).map(s => (
                  <div key={s} className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold">{s}</label>
                    <input type="number" className="w-10 border text-center" value={characteristics[s]} onChange={e => handleStatChange(s, e.target.value)}/>
                  </div>
                ))}
              </div>
            </div>

            <div className="border p-2 bg-gray-50">
              <h2 className="font-bold border-b mb-2 text-xs">Attributes</h2>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div><span className="font-bold">AP:</span> {actionPoints}</div>
                <div><span className="font-bold">Init:</span> {initiativeBonus}</div>
                <div><span className="font-bold">Dmg:</span> {dmgMod}</div>
                <div><span className="font-bold">Heal:</span> {healingRate}</div>
                <div className="text-blue-800 font-bold">Magic: {characteristics.POW}</div>
                <div className="text-red-800 font-bold">Tenacity: {characteristics.POW}</div>
              </div>
            </div>

            <div className="border p-2">
              <h2 className="font-bold border-b mb-1 text-xs">Hit Locations</h2>
              <table className="w-full text-center text-[10px] border">
                <tr className="bg-gray-100"><th>1d20</th><th>Loc</th><th>HP</th></tr>
                <tr><td>19-20</td><td className="text-left">Head</td><td>{hpB}</td></tr>
                <tr><td>10-12</td><td className="text-left">Chest</td><td>{hpB+2}</td></tr>
                <tr><td>7-9</td><td className="text-left">Abdo</td><td>{hpB+1}</td></tr>
                <tr><td>13-18</td><td className="text-left">Arms</td><td>{hpB}</td></tr>
                <tr><td>1-6</td><td className="text-left">Legs</td><td>{hpB}</td></tr>
              </table>
            </div>
          </section>

          {/* COLUMN 3 */}
          <section className="border p-2 max-h-[650px] overflow-y-auto">
            <h2 className="font-bold border-b mb-2">Skills</h2>
            <div className="flex gap-2 text-[9px] font-bold mb-2 p-1 border bg-gray-50">
              <span className={cultureRem < 0 ? 'text-red-600' : 'text-blue-700'}>C: {cultureRem}</span>
              <span className={careerRem < 0 ? 'text-red-600' : 'text-green-700'}>J: {careerRem}</span>
              <span className={bonusRem < 0 ? 'text-red-600' : 'text-purple-700'}>B: {bonusRem}</span>
            </div>
            <table className="w-full">
              <thead className="bg-black text-white text-[9px]">
                <tr><th className="text-left p-1">Skill</th><th>B</th><th>C</th><th>J</th><th>B</th><th>F</th></tr>
              </thead>
              <tbody>
                {standardSkillKeys.map(s => <SkillRow key={s} name={s} base={getStandardBase(s)} type="standard" />)}
                {activeStyle && <SkillRow name={`Style: ${activeStyle.name}`} base={characteristics.STR + characteristics.DEX} type="style" />}
                <tr className="bg-gray-200 font-bold text-[9px] text-center border-y-2 border-black"><td colSpan="6">Professional Skills</td></tr>
                {availableProfSkills.map(s => <SkillRow key={s} name={s} base={getProfSkillBase(s, characteristics)} type="prof" />)}
              </tbody>
            </table>
            {highSpeechTotal > 0 && <p className="text-[9px] italic mt-2 text-red-600">* Sorcery capped at {highSpeechTotal}% (High Speech)</p>}
          </section>
        </div>
      </div>
    </main>
  );
}