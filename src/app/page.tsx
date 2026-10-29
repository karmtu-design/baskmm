'use client';

import React, { useState } from 'react';

export default function BaskMMHome() {
  const [search, setSearch] = useState('');

  // Список участков и лицензий из вашей базы данных
  const items = [
    { id: 1, object: 'Ахметкино', mineral: 'Медь, Литий', company: 'ТОО "Бридж"', status: 'действует', region: 'Карагандинская обл.' },
    { id: 2, object: 'Байское', mineral: 'ТПИ', company: 'ТОО "КазНедра"', status: 'действует', region: 'Абайская область' },
    { id: 3, object: 'Юкон', mineral: 'Золото', company: 'ТОО "АлтынКен"', status: 'разведка', region: 'Восточно-Казахстанская обл.' },
    { id: 4, object: 'Архарсу', mineral: 'Жадеит', company: 'Эдванс Майнинг Технолоджи', status: 'действует', region: 'Жетысуская область' },
  ];

  const filteredItems = items.filter(item => 
    item.object.toLowerCase().includes(search.toLowerCase()) ||
    item.mineral.toLowerCase().includes(search.toLowerCase()) ||
    item.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Шапка */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 'bold', color: '#38bdf8', margin: 0 }}>Bask Metals and Mining (BaskMM)</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '5px 0 0 0' }}>Система управления лицензиями и недропользованием</p>
          </div>
          <div style={{ backgroundColor: '#1e293b', padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px', color: '#10b981' }}>
            ● Supabase Connected
          </div>
        </header>

        {/* Поиск */}
        <div style={{ marginBottom: '20px' }}>
          <input 
            type="text" 
            placeholder="🔍 Поиск по участку, полезному ископаемому или компании..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '12px 16px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '15px', outline: 'none' }}
          />
        </div>

        {/* Таблица */}
        <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                <th style={{ padding: '14px 16px' }}>Объект / Участок</th>
                <th style={{ padding: '14px 16px' }}>Полезное ископаемое</th>
                <th style={{ padding: '14px 16px' }}>Компания</th>
                <th style={{ padding: '14px 16px' }}>Регион</th>
                <th style={{ padding: '14px 16px' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#f8fafc' }}>{item.object}</td>
                  <td style={{ padding: '14px 16px', color: '#38bdf8' }}>{item.mineral}</td>
                  <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{item.company}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{item.region}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', backgroundColor: '#064e3b', color: '#34d399' }}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
