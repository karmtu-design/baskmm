'use client';

import React, { useState, useEffect } from 'react';

export default function BaskMMHome() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Загружаем данные из вашего Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        // Используем ваш публичный эндпоинт Supabase
        const response = await fetch('https://efdbhyndoskczcdikhzo.supabase.co/rest/v1/licenses?select=*', {
          headers: {
            // Публичный ключ доступа (anon key) можно подставить сюда или в переменные Vercel
            'apikey': 'YOUR_SUPABASE_ANON_KEY',
            'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
          }
        });
        const data = await response.json();
        if (Array.isArray(data)) {
          setItems(data);
        }
      } catch (err) {
        console.error('Ошибка загрузки:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredItems = items.filter((item: any) => 
    Object.values(item).some(val => 
      String(val).toLowerCase().includes(search.toLowerCase())
    )
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
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Загрузка данных из Supabase...</td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>Данные не найдены</td>
                </tr>
              ) : (
                filteredItems.map((item: any, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#f8fafc' }}>{item.object || item.name || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#38bdf8' }}>{item.mineral || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#cbd5e1' }}>{item.company || '—'}</td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8' }}>{item.region || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', backgroundColor: '#064e3b', color: '#34d399' }}>
                        {item.status || 'активно'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </main>
  );
}
