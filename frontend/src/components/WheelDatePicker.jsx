import React, { useEffect, useRef, useState, useMemo } from 'react';
import './WheelDatePicker.css';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const ITEM_HEIGHT = 40; // pixels

const WheelColumn = ({ items, value, onChange, label }) => {
  const containerRef = useRef(null);
  const scrollTimeout = useRef(null);
  
  // Calculate which index corresponds to the value
  const initialIndex = Math.max(0, items.findIndex(item => item.value === value));
  
  // Keep local track of index to avoid jumping during scroll
  const [localIndex, setLocalIndex] = useState(initialIndex);

  // Initialize scroll position once mounted
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = initialIndex * ITEM_HEIGHT;
    }
  }, []);

  // Update scroll if value changes from outside
  useEffect(() => {
    const idx = Math.max(0, items.findIndex(item => item.value === value));
    if (idx !== localIndex && containerRef.current) {
      setLocalIndex(idx);
      containerRef.current.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    }
  }, [value, items]);

  const handleScroll = (e) => {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    
    // Calculate the closest index based on scroll position
    const scrollTop = e.target.scrollTop;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    const safeIndex = Math.max(0, Math.min(index, items.length - 1));
    
    if (safeIndex !== localIndex) {
      setLocalIndex(safeIndex);
    }

    // When scrolling stops, trigger the onChange
    scrollTimeout.current = setTimeout(() => {
      const selectedItem = items[safeIndex];
      if (selectedItem && selectedItem.value !== value) {
        onChange(selectedItem.value);
      }
    }, 150);
  };

  const handleItemClick = (index) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: index * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="wheel-column-wrapper">
      <div 
        className="wheel-column" 
        ref={containerRef} 
        onScroll={handleScroll}
      >
        <div className="wheel-padding-top" style={{ height: ITEM_HEIGHT * 2 }} />
        {items.map((item, idx) => (
          <div 
            key={item.value} 
            className={`wheel-item ${localIndex === idx ? 'selected' : ''}`}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => handleItemClick(idx)}
          >
            {item.label}
          </div>
        ))}
        <div className="wheel-padding-bottom" style={{ height: ITEM_HEIGHT * 2 }} />
      </div>
    </div>
  );
};

const WheelDatePicker = ({ value, onChange, onClose }) => {
  // Parse incoming value or use default (2000-01-01)
  const defaultDate = new Date('2000-01-01T00:00:00Z');
  let currentDate = value ? new Date(value) : defaultDate;
  if (isNaN(currentDate.getTime())) currentDate = defaultDate;

  const currentYear = currentDate.getUTCFullYear();
  const currentMonth = currentDate.getUTCMonth();
  const currentDay = currentDate.getUTCDate();

  // Generate Year Array (1940 to Current Year)
  const years = useMemo(() => {
    const endYear = new Date().getFullYear();
    const arr = [];
    for (let y = endYear; y >= 1940; y--) {
      arr.push({ label: y.toString(), value: y });
    }
    return arr;
  }, []);

  // Generate Month Array
  const months = useMemo(() => {
    return MONTHS.map((m, i) => ({ label: m, value: i }));
  }, []);

  // Generate Days array dynamically based on selected year & month
  const days = useMemo(() => {
    // get days in month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const arr = [];
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ label: d.toString().padStart(2, '0'), value: d });
    }
    return arr;
  }, [currentYear, currentMonth]);

  const handleChange = (type, val) => {
    let y = currentYear;
    let m = currentMonth;
    let d = currentDay;

    if (type === 'year') y = val;
    if (type === 'month') m = val;
    if (type === 'day') d = val;

    // Ensure day is valid for the new month/year (e.g. Feb 30 -> Feb 28)
    const maxDays = new Date(y, m + 1, 0).getDate();
    if (d > maxDays) d = maxDays;

    // Format as YYYY-MM-DD
    const newDateStr = `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    onChange(newDateStr);
  };

  return (
    <div className="wheel-picker-container">
      <div className="wheel-picker-header">
        <span className="wheel-picker-title">Select Date of Birth</span>
        <button type="button" className="wheel-picker-close" onClick={onClose}>Done</button>
      </div>
      
      <div className="wheel-picker-body">
        {/* Selection Highlighter */}
        <div className="wheel-selection-overlay" style={{ top: ITEM_HEIGHT * 2, height: ITEM_HEIGHT }} />
        
        <WheelColumn 
          items={months} 
          value={currentMonth} 
          onChange={(val) => handleChange('month', val)} 
          label="Month" 
        />
        <WheelColumn 
          items={days} 
          value={currentDay} 
          onChange={(val) => handleChange('day', val)} 
          label="Day" 
        />
        <WheelColumn 
          items={years} 
          value={currentYear} 
          onChange={(val) => handleChange('year', val)} 
          label="Year" 
        />
      </div>
    </div>
  );
};

export default WheelDatePicker;
