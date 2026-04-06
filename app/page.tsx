"use client";

import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import culturesData from '../data/cultures.json';
import careersData from '../data/careers.json';
import stylesData from '../data/combatStyles.json';
import backgroundEventsData from '../data/backgroundEvents.json';

// --- THEME ASSETS ---
const parchmentBg = "https://www.transparenttextures.com/patterns/parchment.png";
const watermarkURL = "https://worldofspectrum.org/pub/sinclair/screens/load/p/scr/PanTang.png"; 

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

// --- SMART BASE CALCULATOR ---
const getProfSkillBase = (skillName: string, chars: Characteristics) => {
  const name = skillName.toLowerCase();
  if (name.includes('art') || name.includes('witch sight') || name.includes('devotion') || name.includes('pact')) return chars.POW + chars.CHA;
  if (name.includes('commerce') || name.includes('courtesy') || name.includes('language')) return chars.INT + chars.CHA;
  if (name.includes('craft')) return chars.DEX + chars.INT;
  if (name.includes('streetwise') || name.includes('binding') || name.includes('command')) return chars.POW + chars.CHA;
  if (name.includes('lore') || name.includes('locale') || name.includes('literacy')) return chars.INT * 2;
  if (name.includes('navigation') || name.includes('healing') || name.includes('rune casting') || name.includes('summoning')) return chars.INT + chars.POW;
  if (name.includes('survival') || name.includes('track')) return chars.CON + chars.POW;
  if (name.includes('trance') || name.includes('dreamtheft')) return chars.POW * 2;
  if (name.includes('combat style')) return chars.STR + chars.DEX;
  return chars.INT * 2; // Fallback
};

// --- DICE ROLLER LOGIC ---
const rollD6 = () => Math.floor(Math.random() * 6) + 1;
const rollStat = (dice: number, bonus: number) => {
  const rollOnce = () => Array.from({length: dice}, rollD6).reduce((a, b) => a + b, 0) + bonus;
  let firstRoll = rollOnce();
  if (firstRoll < 10) {
    let secondRoll = rollOnce();
    return Math.max(firstRoll, secondRoll);
  }
  return firstRoll;
};

export default function CharacterBuilder() {
  const builderRef = useRef<HTMLDivElement>(null);
  const printSheetRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- STATE ---
  const [name, setName] = useState("");
  const [race, setRace] = useState("Human");
  const [age, setAge] = useState(18);
  const [background, setBackground] = useState("Roll for a Background Event...");
  const [socialClass, setSocialClass] = useState("Freeman");
  const [money, setMoney] = useState("4d6 x 75 SP");
  const [connections, setConnections] = useState("");
  const [equipment, setEquipment] = useState("");
  
  const [characteristics, setCharacteristics] = useState<Characteristics>({ STR: 10, CON: 10, SIZ: 10, DEX: 10, INT: 10, POW: 10, CHA: 10 });
  const [selectedCulture, setSelectedCulture] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");
  const [passions, setPassions] = useState([{ id: 1, target: "Melniboné", val: 0 }]);
  const [dedicatedMPs, setDedicatedMPs] = useState(0);
  const [skillSpends, setSkillSpends] = useState<Record<string, SkillSpend>>({});
  
  // Custom Runes & Skills
  const [rune1, setRune1] = useState("Rune of...");
  const [rune2, setRune2] = useState("Rune of...");
  const [rune3, setRune3] = useState("Rune of...");
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [newSkillBase, setNewSkillBase] = useState("Lore");
  const [newSkillSpec, setNewSkillSpec] = useState("");

  // --- AGE CATEGORY & SCALING MATH ---
  let ageCategory = "Adult";
  let bonusPoolMax = 150;
  let bonusSpendMax = 15;
  
  if (age < 17) { ageCategory = "Young"; bonusPoolMax = 100; bonusSpendMax = 10; }
  else if (age < 28) { ageCategory = "Adult"; bonusPoolMax = 150; bonusSpendMax = 15; }
  else if (age < 44) { ageCategory = "Middle Aged"; bonusPoolMax = 200; bonusSpendMax = 20; }
  else if (age < 65) { ageCategory = "Senior"; bonusPoolMax = 250; bonusSpendMax = 25; }
  else { ageCategory = "Old"; bonusPoolMax = 300; bonusSpendMax = 30; }

  const getAgeingText = () => {
    if (age < 40) return null;
    let rolls = [];
    if (age >= 40) rolls.push("Early Middle");
    if (age >= 50) rolls.push("Middle");
    if (age >= 60) rolls.push("Late Middle");
    if (age >= 70) rolls.push("Old Age");
    if (age >= 80) rolls.push("Advanced Old");
    if (age >= 90) rolls.push("Dotage");
    return `Ageing Rolls Required: ${rolls.join(", ")}`;
  };

  // --- DERIVED DATA & MATH ---
  const activeCulture = (culturesData as any[]).find(c => c.id === selectedCulture);
  const activeCareer = (careersData as any[]).find(c => c.id === selectedCareer);

  const cultureProfs: string[] = activeCulture?.professionalSkills || [];
  const careerProfs: string[] = activeCareer?.professionalSkills || [];
  const careerStandards: string[] = activeCareer?.standardSkills || [];
  
  const availableProfSkills = [...new Set([...cultureProfs, ...careerProfs])].sort();
  const allProfSkills = [...new Set([...availableProfSkills, ...customSkills])].sort();

  const charPoints = Object.values(characteristics).reduce((a, b) => a + b, 0);
  const cultureSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.culture || 0), 0);
  const careerSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.career || 0), 0);
  const bonusSpent = Object.values(skillSpends).reduce((acc, s) => acc + (s.bonus || 0), 0);

  // Mythras Derived Combat Stats
  const hpBase = Math.ceil((characteristics.CON + characteristics.SIZ) / 5);
  const actionPoints = characteristics.DEX + characteristics.INT <= 24 ? 2 : 3;
  const initiative = Math.ceil((characteristics.DEX + characteristics.INT) / 2);
  const strSiz = characteristics.STR + characteristics.SIZ;
  let damageMod = "+0";
  if (strSiz <= 5) damageMod = "-1d8";
  else if (strSiz <= 10) damageMod = "-1d6";
  else if (strSiz <= 15) damageMod = "-1d4";
  else if (strSiz <= 20) damageMod = "-1d2";
  else if (strSiz <= 25) damageMod = "+0";
  else if (strSiz <= 30) damageMod = "+1d2";
  else if (strSiz <= 35) damageMod = "+1d4";
  else if (strSiz <= 40) damageMod = "+1d6";
  else if (strSiz <= 45) damageMod = "+1d8";
  else if (strSiz <= 50) damageMod = "+1d10";
  else if (strSiz <= 60) damageMod = "+1d12";

  let healingRate = 1;
  if (characteristics.CON >= 6 && characteristics.CON <= 10) healingRate = 2;
  else if (characteristics.CON >= 11 && characteristics.CON <= 15) healingRate = 3;
  else if (characteristics.CON >= 16) healingRate = Math.ceil(characteristics.CON / 5);

  let luck = 1;
  if (characteristics.POW >= 7 && characteristics.POW <= 12) luck = 2;
  else if (characteristics.POW >= 13 && characteristics.POW <= 18) luck = 3;
  else if (characteristics.POW >= 19) luck = Math.ceil(characteristics.POW / 6);

  const movement = race === "Myyrrhn" ? "6m (12m Fly)" : "6m";

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

  const handleAddCustomSkill = () => {
    if (newSkillSpec.trim() === "") return;
    const skillName = newSkillBase === "Custom Professional" ? newSkillSpec : `${newSkillBase} (${newSkillSpec})`;
    if (!customSkills.includes(skillName)) setCustomSkills([...customSkills, skillName]);
    setNewSkillSpec("");
  };

  const removeCustomSkill = (skillToRemove: string) => {
    setCustomSkills(customSkills.filter(s => s !== skillToRemove));
    setSkillSpends(prev => { const updated = { ...prev }; delete updated[skillToRemove]; return updated; });
  };

  const handleRandomizeStats = () => {
    setCharacteristics({
      STR: rollStat(3, 0), CON: rollStat(3, 0), SIZ: rollStat(2, 6),
      DEX: rollStat(3, 0), INT: rollStat(2, 6), POW: rollStat(3, 0), CHA: rollStat(3, 0)
    });
  };

  // --- DEDICATED PRINT EXPORT LOGIC ---
  const handleExportPDF = () => {
    if (!printSheetRef.current) return;
    setIsExporting(true);
    
    setTimeout(async () => {
      try {
        if (!printSheetRef.current) return;
        
        // Temporarily display the hidden sheet for html2canvas to capture it
        printSheetRef.current.style.display = 'block';

        const canvas = await html2canvas(printSheetRef.current, { 
          scale: 2, 
          backgroundColor: '#ffffff'
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Portrait Orientation for Classic Sheet Feel
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${name || 'Elric_Character'}_Sheet.pdf`);

      } catch (error) {
        console.error("Failed to export PDF", error);
        alert("There was an error generating the PDF.");
      } finally {
        if (printSheetRef.current) printSheetRef.current.style.display = 'none'; // Hide it again
        setIsExporting(false);
      }
    }, 150);
  };

  // Helper for rendering skills safely in the print view
  const getTotalSkill = (name: string, base: number) => {
    const s = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    return base + s.culture + s.career + s.bonus;
  };

  // --- BUILDER UI (Interactive Component) ---
  const BuilderSkillRow = ({ name, base, type }: { name: string, base: number, type: string }) => {
    const s = skillSpends[name] || { culture: 0, career: 0, bonus: 0 };
    const total = base + s.culture + s.career + s.bonus;
    const isMagic = ["Summoning Ritual", "Command", "Rune Casting"].includes(name);
    const overCap = isMagic && total > highSpeechTotal;
    const isCustom = customSkills.includes(name);
    const canCulture = type === "standard" || cultureProfs.includes(name) || type === "style" || type === "magic" || isCustom;
    const canCareer = careerStandards.includes(name) || careerProfs.includes(name) || type === "style" || type === "magic" || isCustom;

    return (
      <tr className="border-b text-[10px]" style={{ borderColor: '#d1d5db', backgroundColor: overCap ? '#fee2e2' : 'transparent' }}>
        <td className="p-1 font-bold flex justify-between items-center" style={{ color: overCap ? '#dc2626' : '#000000' }}>
          <span>{name}</span>
          {isCustom && <button onClick={() => removeCustomSkill(name)} className="font-bold px-1 ml-2 opacity-50 hover:opacity-100" style={{ color: '#ef4444' }} title="Remove Hobby Skill">×</button>}
        </td>
        <td className="text-center" style={{ color: '#6b7280' }}>{base}</td>
        <td className="text-center border-l" style={{ backgroundColor: '#eff6ff', borderColor: '#e5e7eb' }}>
            <input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent focus:outline-none" disabled={!canCulture} value={s.culture} onChange={e => handleSkillChange(name, 'culture', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center border-l" style={{ backgroundColor: '#f0fdf4', borderColor: '#e5e7eb' }}>
            <input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent focus:outline-none" disabled={!canCareer} value={s.career} onChange={e => handleSkillChange(name, 'career', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center border-l" style={{ backgroundColor: '#faf5ff', borderColor: '#e5e7eb' }}>
            <input type="number" step={1} min="0" max={bonusSpendMax} className="w-8 text-center bg-transparent focus:outline-none" value={s.bonus} onChange={e => handleSkillChange(name, 'bonus', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
        </td>
        <td className="text-center font-bold border-l" style={{ borderColor: '#e5e7eb', color: '#000000' }}>{total}%</td>
      </tr>
    );
  };

  return (
    <>
      {/* -------------------------------------------------------------
          1. INTERACTIVE BUILDER VIEW (What the user interacts with)
          ------------------------------------------------------------- */}
      <main className="min-h-screen p-4 font-serif" style={{ backgroundColor: "#ece0c8", backgroundImage: `url(${parchmentBg})`, color: '#000000', display: isExporting ? 'none' : 'block' }}>
        <div className="max-w-7xl mx-auto flex justify-end mb-2">
          <button onClick={handleExportPDF} className="px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors shadow-md border-2 border-transparent" style={{ backgroundColor: '#000000', color: '#ffffff', cursor: 'pointer' }}>
            Download Classic PDF Sheet
          </button>
        </div>

        <div ref={builderRef} className="max-w-7xl mx-auto border-4 p-6 relative overflow-hidden" style={{ borderColor: '#000000', backgroundColor: '#ffffff', boxShadow: '0 0 50px rgba(0,0,0,0.2)' }}>
          <header className="border-b-4 mb-4 pb-2 flex justify-between items-end" style={{ borderColor: '#000000' }}>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic" style={{ color: '#000000' }}>Elric: Mythras Builder</h1>
            <div className="text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7f1d1d' }}>Interactive Data Entry Mode</div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            {/* COLUMN 1: IDENTITY, CULTURE, CONNECTIONS & EQUIPMENT */}
            <section className="space-y-4">
              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
                <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#7f1d1d' }}>Identity</h2>
                <input placeholder="Character Name" className="w-full text-xs border p-1 mb-1" value={name} onChange={e => setName(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <select className="text-xs border p-1" value={race} onChange={e => setRace(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                      <option>Human</option><option>Melnibonéan</option><option>Myyrrhn</option>
                  </select>
                  <div className="flex items-center gap-1 border p-1" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff' }}>
                    <span className="text-[9px] font-bold" style={{ opacity: 0.5, color: '#000000' }}>AGE:</span>
                    <input type="number" className="text-xs w-full bg-transparent outline-none font-bold" value={age} onChange={e => setAge(parseInt(e.target.value) || 18)} style={{ color: '#000000' }} />
                  </div>
                </div>
                <div className="text-[8px] font-bold uppercase tracking-widest text-center" style={{ color: '#1e3a8a' }}>Category: {ageCategory}</div>
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#fffbeb' }}>
                <h2 className="font-bold border-b mb-1 uppercase text-[10px] flex justify-between font-black" style={{ borderColor: '#000000', color: '#000000' }}>
                  Background <button onClick={() => setBackground(backgroundEventsData[Math.floor(Math.random()*backgroundEventsData.length)])} className="px-1 text-[8px]" style={{ backgroundColor: '#000000', color: '#ffffff', cursor: 'pointer' }}>Roll</button>
                </h2>
                <p className="text-[10px] italic leading-tight min-h-[35px] flex items-center" style={{ color: '#000000' }}>{background}</p>
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#eff6ff' }}>
                <h2 className="font-bold border-b mb-1 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#1e3a8a' }}>Homeland & Class</h2>
                <select className="w-full text-xs border p-1 mb-1" value={selectedCulture} onChange={e => setSelectedCulture(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                  <option value="">Choose Kingdom...</option>
                  {(culturesData as any[]).map(c => <option key={c.id} value={c.id}>{c.kingdom}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <input placeholder="Social Class..." className="text-[10px] border p-1 w-full" value={socialClass} onChange={e => setSocialClass(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
                  <input placeholder="Starting SP..." className="text-[10px] border p-1 w-full font-bold" value={money} onChange={e => setMoney(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
                </div>
                <select className="w-full text-xs border p-1" value={selectedCareer} onChange={e => setSelectedCareer(e.target.value)} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>
                  <option value="">Choose Career...</option>
                  {(careersData as any[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#fdf4ff' }}>
                <h2 className="font-bold border-b mb-1 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#701a75' }}>Community & Family</h2>
                <textarea className="w-full text-[9px] p-1 outline-none border" rows={3} placeholder="List family members, allies, enemies, or mentors here..." value={connections} onChange={e => setConnections(e.target.value)} style={{ resize: 'none', backgroundColor: '#ffffff', borderColor: '#d1d5db', color: '#000000' }} />
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#f8fafc' }}>
                <h2 className="font-bold border-b mb-1 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#0f172a' }}>Inventory & Arms</h2>
                <textarea className="w-full text-[9px] p-1 outline-none border" rows={5} placeholder="Weapons, Armor, Grimoires, Potions, General Gear..." value={equipment} onChange={e => setEquipment(e.target.value)} style={{ resize: 'none', backgroundColor: '#ffffff', borderColor: '#d1d5db', color: '#000000' }} />
              </div>
            </section>

            {/* COLUMN 2: STATS, ATTRIBUTES & LOCATIONS */}
            <section className="space-y-4">
              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
                <h2 className="font-bold border-b mb-2 uppercase text-[10px] flex justify-between font-black" style={{ borderColor: '#000000', color: '#000000' }}>
                  Stats 
                  <span className="flex items-center gap-2">
                    <button onClick={handleRandomizeStats} className="px-1 text-[8px]" style={{ backgroundColor: '#000000', color: '#ffffff', cursor: 'pointer' }}>🎲 Roll</button>
                    <span className="font-black" style={{ color: charPoints > 80 ? '#dc2626' : '#9ca3af' }}>{charPoints}/80</span>
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-x-4">
                  {(Object.keys(characteristics) as (keyof Characteristics)[]).map(k => (
                    <div key={k} className="flex justify-between items-center text-xs mb-1 border-b" style={{ borderColor: '#e5e7eb' }}>
                      <span className="font-bold" style={{ opacity: 0.7, color: '#000000' }}>{k}</span>
                      <input type="number" className="w-8 border-none text-center bg-transparent font-black outline-none" value={characteristics[k]} onChange={e => setCharacteristics({...characteristics, [k]: parseInt(e.target.value) || 0})} style={{ color: '#000000' }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#f5f5f4' }}>
                <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#000000' }}>Attributes</h2>
                <div className="text-[10px] space-y-1" style={{ color: '#000000' }}>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Action Points:</span> <strong>{actionPoints}</strong></div>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Damage Modifier:</span> <strong>{damageMod}</strong></div>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Initiative Bonus:</span> <strong>{initiative}</strong></div>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Healing Rate:</span> <strong>{healingRate}</strong></div>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Luck Points:</span> <strong>{luck}</strong></div>
                  <div className="flex justify-between border-b" style={{ borderColor: '#f3f4f6' }}><span>Movement:</span> <strong>{movement}</strong></div>
                  <div className="flex justify-between border-b font-black" style={{ borderColor: '#f3f4f6', color: '#1e3a8a' }}><span>Tenacity (POW):</span> <strong>{characteristics.POW}</strong></div>
                  <div className="flex justify-between"><span>Magic Points:</span> <strong>{characteristics.POW - dedicatedMPs}</strong></div>
                </div>
                {getAgeingText() && (
                  <div className="mt-2 p-1 text-[8px] font-bold uppercase tracking-wide text-center" style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #f87171' }}>
                    {getAgeingText()}
                  </div>
                )}
              </div>

              <div className="border-2 p-2" style={{ borderColor: '#000000', backgroundColor: '#faf5ff' }}>
                <h2 className="font-bold border-b mb-2 uppercase text-[10px] font-black" style={{ borderColor: '#000000', color: '#581c87' }}>Passions</h2>
                {passions.map((p, idx) => (
                  <div key={p.id} className="flex gap-1 mb-1 items-center">
                    <input className="text-[10px] border flex-1 p-1 outline-none" placeholder="Love / Hate..." value={p.target} onChange={e => { const n = [...passions]; n[idx].target = e.target.value; setPassions(n); }} style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }} />
                    <span className="text-[10px] font-black p-1 border min-w-[35px] text-center" style={{ borderColor: '#d1d5db', backgroundColor: '#ffffff', color: '#000000' }}>{characteristics.POW + characteristics.CHA + 30}%</span>
                    <button onClick={() => setPassions(passions.filter(x => x.id !== p.id))} className="font-bold text-xs" style={{ color: '#dc2626', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                <button onClick={() => setPassions([...passions, {id: Date.now(), target: "", val: 0}])} className="text-[8px] w-full py-1 mt-1 uppercase" style={{ backgroundColor: '#000000', color: '#ffffff', cursor: 'pointer' }}>+ Add Passion</button>
              </div>
            </section>

            {/* COLUMN 3 & 4: SKILLS & MAGIC TABLE */}
            <section className="md:col-span-2 border-2 flex flex-col" style={{ borderColor: '#000000', backgroundColor: '#ffffff' }}>
              <div className="p-1 flex justify-around text-[9px] font-bold uppercase tracking-tighter" style={{ backgroundColor: '#000000', color: '#ffffff' }}>
                <div className="underline underline-offset-2" style={{ color: cultureSpent > 100 ? '#f87171' : '#ffffff' }}>Cult: {cultureSpent}/100</div>
                <div className="underline underline-offset-2" style={{ color: careerSpent > 100 ? '#f87171' : '#ffffff' }}>Car: {careerSpent}/100</div>
                <div className="underline underline-offset-2" style={{ color: bonusSpent > bonusPoolMax ? '#f87171' : '#ffffff' }}>Bonus: {bonusSpent}/{bonusPoolMax}</div>
              </div>
              
              <div className="overflow-y-auto max-h-[800px] p-2 flex-1">
                <table className="w-full border-collapse">
                  <thead className="text-[9px] uppercase border-b text-left" style={{ borderColor: '#000000', color: '#000000' }}>
                    <tr><th className="p-1">Skill</th><th>Base</th><th className="text-center" style={{ backgroundColor: '#eff6ff' }}>C</th><th className="text-center" style={{ backgroundColor: '#f0fdf4' }}>J</th><th className="text-center" style={{ backgroundColor: '#faf5ff' }}>B</th><th className="text-center font-black">Total</th></tr>
                  </thead>
                  <tbody>
                    {standardSkillKeys.map(k => <BuilderSkillRow key={k} name={k} base={getStandardBase(k)} type="standard" />)}
                    <tr className="text-[9px] font-bold text-center uppercase tracking-widest" style={{ backgroundColor: '#f3f4f6', color: '#000000' }}><td colSpan={6} className="py-1">Professional Skills</td></tr>
                    {allProfSkills.map(k => <BuilderSkillRow key={k} name={k} base={getProfSkillBase(k, characteristics)} type="prof" />)}
                    <tr className="text-[9px] font-bold text-center uppercase tracking-widest" style={{ backgroundColor: '#fef2f2', color: '#7f1d1d' }}><td colSpan={6} className="py-1">Magic & Runic Affinities</td></tr>
                    <BuilderSkillRow name="Folk Magic" base={characteristics.POW + characteristics.CHA + 30} type="magic" />
                    
                    {/* Dynamic Rune Rows for Builder */}
                    {[rune1, rune2, rune3].map((r, idx) => {
                       const bases = [30, 20, 10];
                       const base = characteristics.POW + characteristics.POW + bases[idx];
                       const setter = idx === 0 ? setRune1 : idx === 1 ? setRune2 : setRune3;
                       const s = skillSpends[r] || { culture: 0, career: 0, bonus: 0 };
                       return (
                        <tr key={idx} className="border-b text-[10px]" style={{ borderColor: '#d1d5db' }}>
                          <td className="p-1 font-bold">
                            <input className="bg-transparent outline-none font-bold w-full" value={r} onChange={e => setter(e.target.value)} style={{ color: '#000000' }} />
                          </td>
                          <td className="text-center" style={{ color: '#6b7280' }}>{base}</td>
                          <td className="text-center border-l" style={{ backgroundColor: '#eff6ff', borderColor: '#e5e7eb' }}>
                              <input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent focus:outline-none" value={s.culture} onChange={e => handleSkillChange(r, 'culture', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
                          </td>
                          <td className="text-center border-l" style={{ backgroundColor: '#f0fdf4', borderColor: '#e5e7eb' }}>
                              <input type="number" step={5} min="0" max="15" className="w-8 text-center bg-transparent focus:outline-none" value={s.career} onChange={e => handleSkillChange(r, 'career', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
                          </td>
                          <td className="text-center border-l" style={{ backgroundColor: '#faf5ff', borderColor: '#e5e7eb' }}>
                              <input type="number" step={1} min="0" max={bonusSpendMax} className="w-8 text-center bg-transparent focus:outline-none" value={s.bonus} onChange={e => handleSkillChange(r, 'bonus', parseInt(e.target.value) || 0)} style={{ color: '#000000' }} />
                          </td>
                          <td className="text-center font-bold border-l" style={{ borderColor: '#e5e7eb', color: '#000000' }}>{base + s.culture + s.career + s.bonus}%</td>
                        </tr>
                       )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-2 border-t text-[9px] flex gap-2 items-center" style={{ borderColor: '#000000', backgroundColor: '#f9fafb' }}>
                <span className="font-bold uppercase tracking-wider">Hobby ({customSkills.length} / {age >= 28 ? 2 : 1}):</span>
                <select className="border p-1 bg-white outline-none" value={newSkillBase} onChange={e => setNewSkillBase(e.target.value)} style={{ borderColor: '#d1d5db', color: '#000000' }}>
                  <option>Lore</option><option>Craft</option><option>Art</option><option>Language</option><option>Combat Style</option><option>Custom Professional</option>
                </select>
                <input className="border p-1 flex-1 outline-none" placeholder="e.g. History, Blacksmithing..." value={newSkillSpec} onChange={e => setNewSkillSpec(e.target.value)} style={{ borderColor: '#d1d5db', color: '#000000' }} />
                <button onClick={handleAddCustomSkill} disabled={customSkills.length >= (age >= 28 ? 2 : 1)} className="px-3 py-1 font-bold tracking-widest text-white uppercase disabled:opacity-30 disabled:cursor-not-allowed" style={{ backgroundColor: '#000000', cursor: 'pointer' }}>Add</button>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* -------------------------------------------------------------
          2. HIDDEN PRINT VIEW (Classic Mythras/Elric Tabletop Sheet)
          ------------------------------------------------------------- */}
      <div 
        ref={printSheetRef} 
        style={{ 
          display: 'none', 
          width: '900px', 
          padding: '30px', 
          backgroundColor: '#ffffff', 
          color: '#000000', 
          fontFamily: 'serif' 
        }}
      >
        {/* PRINT HEADER */}
        <header className="mb-6 flex justify-between items-center" style={{ borderBottom: '6px solid #000000', paddingBottom: '8px' }}>
          <div>
            <h1 style={{ color: '#000000', margin: 0, fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.05em' }}>ELRIC!</h1>
            <div style={{ color: '#000000', fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RuneQuest / Mythras System Sheet</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'right' }}>
            <div style={{ borderBottom: '2px solid #000000', minWidth: '200px', paddingBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8px' }}>Name:</span> 
              <span style={{ fontSize: '18px', fontStyle: 'italic' }}>{name || "________________"}</span>
            </div>
            <div style={{ borderBottom: '2px solid #000000', minWidth: '200px', paddingBottom: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginRight: '8px' }}>Player:</span> 
              <span style={{ fontSize: '18px', fontStyle: 'italic' }}>________________</span>
            </div>
          </div>
        </header>

        {/* PRINT CORE IDENTITY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px', marginBottom: '24px', padding: '16px', border: '4px solid #000000' }}>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Race:</span> {race}</div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Age:</span> {age} ({ageCategory})</div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Culture:</span> {activeCulture?.kingdom || "None"}</div>
            <div style={{ borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Social Class:</span> {socialClass}</div>
            <div style={{ gridColumn: 'span 2', borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Career:</span> {activeCareer?.name || "None"}</div>
            <div style={{ gridColumn: 'span 2', borderBottom: '1px dashed #000000', paddingBottom: '2px' }}><span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 'bold' }}>Starting Money:</span> {money}</div>
        </div>

        {/* PRINT 3-COLUMN STRUCTURE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '24px' }}>
          
          {/* PRINT COL 1: STATS & ATTRIBUTES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Characteristics */}
            <div>
              <h3 style={{ backgroundColor: '#000000', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', padding: '4px 0', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>Characteristics</h3>
              <table style={{ width: '100%', fontSize: '14px', border: '2px solid #000000', borderCollapse: 'collapse' }}>
                <tbody>
                  {(Object.keys(characteristics) as (keyof Characteristics)[]).map((k, idx) => (
                    <tr key={k} style={{ backgroundColor: idx % 2 === 0 ? '#f3f4f6' : '#ffffff' }}>
                      <td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000', width: '60%' }}>{k}</td>
                      <td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{characteristics[k]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Attributes */}
            <div>
              <h3 style={{ backgroundColor: '#000000', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', padding: '4px 0', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>Derived Attributes</h3>
              <table style={{ width: '100%', fontSize: '14px', border: '2px solid #000000', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ backgroundColor: '#f3f4f6' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Action Points</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{actionPoints}</td></tr>
                  <tr style={{ backgroundColor: '#ffffff' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Damage Modifier</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{damageMod}</td></tr>
                  <tr style={{ backgroundColor: '#f3f4f6' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Initiative Bonus</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{initiative}</td></tr>
                  <tr style={{ backgroundColor: '#ffffff' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Healing Rate</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{healingRate}</td></tr>
                  <tr style={{ backgroundColor: '#f3f4f6' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Movement</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{movement}</td></tr>
                  <tr style={{ backgroundColor: '#ffffff' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Luck Points</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{luck}</td></tr>
                  <tr style={{ backgroundColor: '#f3f4f6' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Tenacity (POW)</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{characteristics.POW}</td></tr>
                  <tr style={{ backgroundColor: '#ffffff' }}><td style={{ padding: '4px', fontWeight: 'bold', borderRight: '1px solid #000000' }}>Magic Pts (Available)</td><td style={{ padding: '4px', textAlign: 'center', fontWeight: '900' }}>{characteristics.POW - dedicatedMPs}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Hit Locations */}
            <div>
              <h3 style={{ backgroundColor: '#000000', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', padding: '4px 0', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>Hit Locations & Armour</h3>
              <table style={{ width: '100%', fontSize: '10px', textAlign: 'center', border: '2px solid #000000', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px', borderBottom: '2px solid #000000' }}>1d20</th>
                    <th style={{ textAlign: 'left', borderBottom: '2px solid #000000' }}>Location</th>
                    <th style={{ borderBottom: '2px solid #000000' }}>AP</th>
                    <th style={{ borderBottom: '2px solid #000000' }}>HP</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>1-3</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Right Leg</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{hpBase}</td></tr>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>4-6</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Left Leg</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{hpBase}</td></tr>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>7-9</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Abdomen</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{hpBase + 1}</td></tr>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>10-12</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Chest</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{hpBase + 2}</td></tr>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>13-15</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Right Arm</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{Math.max(1, hpBase - 1)}</td></tr>
                  <tr><td style={{ borderBottom: '1px dotted #000000' }}>16-18</td><td style={{ textAlign: 'left', fontWeight: 'bold', borderBottom: '1px dotted #000000' }}>Left Arm</td><td style={{ borderBottom: '1px dotted #000000' }}>___</td><td style={{ fontWeight: '900', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{Math.max(1, hpBase - 1)}</td></tr>
                  <tr><td>19-20</td><td style={{ textAlign: 'left', fontWeight: 'bold' }}>Head</td><td>___</td><td style={{ fontWeight: '900', fontSize: '14px' }}>{hpBase}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Passions */}
            <div>
              <h3 style={{ backgroundColor: '#000000', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', padding: '4px 0', margin: '0 0 8px 0', letterSpacing: '0.1em' }}>Passions</h3>
              <table style={{ width: '100%', fontSize: '14px', border: '2px solid #000000', borderCollapse: 'collapse' }}>
                <tbody>
                  {passions.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px', fontWeight: 'bold', borderBottom: '1px solid #000000' }}>{p.target || "__________________"}</td>
                      <td style={{ padding: '4px', textAlign: 'center', fontWeight: '900', borderLeft: '1px solid #000000', borderBottom: '1px solid #000000', width: '25%' }}>{characteristics.POW + characteristics.CHA + 30}%</td>
                    </tr>
                  ))}
                  {[...Array(Math.max(0, 3 - passions.length))].map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td style={{ padding: '4px', fontWeight: 'bold', borderBottom: '1px solid #000000' }}>__________________</td>
                      <td style={{ padding: '4px', borderLeft: '1px solid #000000', borderBottom: '1px solid #000000' }}></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* PRINT COL 2 & 3: SKILLS & GEAR */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Skills Table */}
            <div style={{ border: '2px solid #000000' }}>
              <h3 style={{ backgroundColor: '#000000', color: '#ffffff', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', padding: '4px 0', margin: '0', letterSpacing: '0.1em' }}>Skills</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', padding: '8px' }}>
                {/* Standard Skills Column */}
                <div>
                  <h4 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #000000' }}>Standard Skills</h4>
                  <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {standardSkillKeys.map(k => (
                        <tr key={k}>
                          <td style={{ padding: '2px 0', borderBottom: '1px dotted #000000' }}>{k}</td>
                          <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{getTotalSkill(k, getStandardBase(k))}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Professional Skills Column */}
                <div>
                  <h4 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px', borderBottom: '1px solid #000000' }}>Professional & Combat Skills</h4>
                  <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                    <tbody>
                      {allProfSkills.map(k => (
                        <tr key={k}>
                          <td style={{ padding: '2px 0', borderBottom: '1px dotted #000000' }}>{k}</td>
                          <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{getTotalSkill(k, getProfSkillBase(k, characteristics))}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', marginTop: '16px', marginBottom: '4px', borderBottom: '1px solid #000000' }}>Magic & Runes</h4>
                  <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 0', borderBottom: '1px dotted #000000' }}>Folk Magic</td>
                        <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{getTotalSkill("Folk Magic", characteristics.POW + characteristics.CHA + 30)}%</td>
                      </tr>
                      {[rune1, rune2, rune3].map((r, idx) => {
                         const bases = [30, 20, 10];
                         const base = characteristics.POW + characteristics.POW + bases[idx];
                         return (
                          <tr key={`print-rune-${idx}`}>
                            <td style={{ padding: '2px 0', borderBottom: '1px dotted #000000' }}>{r.includes("...") ? "__________________" : r}</td>
                            <td style={{ padding: '2px 0', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', borderBottom: '1px dotted #000000' }}>{getTotalSkill(r, base)}%</td>
                          </tr>
                         );
                      })}
                    </tbody>
                  </table>
                  <div style={{ fontSize: '8px', fontStyle: 'italic', marginTop: '8px', textAlign: 'right' }}>Magic Cap: High Speech ({highSpeechTotal}%)</div>
                </div>
              </div>
            </div>

            {/* Background & Connections Box */}
            <div style={{ border: '2px solid #000000', padding: '8px', flex: 1 }}>
               <h3 style={{ borderBottom: '2px solid #000000', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', paddingBottom: '4px', letterSpacing: '0.1em' }}>Background & Connections</h3>
               <p style={{ fontSize: '12px', fontStyle: 'italic', marginBottom: '8px', margin: 0 }}>{background}</p>
               <p style={{ fontSize: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0, marginTop: '8px' }}>{connections || "No familial or allied connections recorded."}</p>
            </div>

            {/* Equipment Box */}
            <div style={{ border: '2px solid #000000', padding: '8px', flex: 1 }}>
               <h3 style={{ borderBottom: '2px solid #000000', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10px', marginBottom: '8px', paddingBottom: '4px', letterSpacing: '0.1em' }}>Equipment, Armour & Grimoires</h3>
               <p style={{ fontSize: '10px', lineHeight: '1.5', whiteSpace: 'pre-wrap', margin: 0 }}>{equipment || "No equipment recorded."}</p>
            </div>

          </div>
        </div>

        {/* PRINT FOOTER */}
        <footer style={{ marginTop: '16px', textAlign: 'center', fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', color: '#000000' }}>
          Moorcock's Young Kingdoms • Generated via Ultimate Mythras 14-Step Builder
        </footer>

      </div>
    </>
  );
}