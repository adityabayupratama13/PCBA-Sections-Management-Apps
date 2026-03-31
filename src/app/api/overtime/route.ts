import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'giken-mysql',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'pcba_engineering_db',
  port: parseInt(process.env.MYSQL_PORT || '3306')
};

export async function GET() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query(`
      SELECT id, member_name, DATE_FORMAT(request_date, '%Y-%m-%d') as request_date, start_time, end_time, hours, reason, revision_count, status, it_supervisor_approved_by, manager_approved_by, declined_by, decline_reason, created_at, updated_at 
      FROM overtime_requests ORDER BY created_at DESC
    `);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('API /overtime GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function POST(req: Request) {
  let connection;
  try {
    const data = await req.json();
    connection = await mysql.createConnection(dbConfig);
    
    const [result] = await connection.execute(
      `INSERT INTO overtime_requests (
        member_name, request_date, start_time, end_time, hours, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        data.member_name, 
        data.request_date, 
        data.start_time, 
        data.end_time, 
        data.hours, 
        data.reason
      ]
    );
    
    return NextResponse.json({ id: (result as mysql.ResultSetHeader).insertId, ...data, status: 'Pending' }, { status: 201 });
  } catch (error) {
    console.error('API /overtime POST Error:', error);
    return NextResponse.json({ error: 'Failed to create overtime request' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function PUT(req: Request) {
  let connection;
  try {
    const data = await req.json();
    const { id, isRevision, ...fields } = data;
    
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    connection = await mysql.createConnection(dbConfig);
    
    if (isRevision) {
      await connection.execute(
        `UPDATE overtime_requests 
         SET start_time=?, end_time=?, hours=?, reason=?, status='Pending', 
             revision_count = revision_count + 1,
             it_supervisor_approved_by='', it_supervisor_approved_at=NULL,
             manager_approved_by='', manager_approved_at=NULL,
             declined_by='', decline_reason=''
         WHERE id=?`,
        [fields.start_time, fields.end_time, fields.hours, fields.reason, id]
      );
    } else {
      // Build dynamic update
      const updates = [];
      const values = [];
      
      const updatableFields = ['status', 'it_supervisor_approved_by', 'manager_approved_by', 'declined_by', 'decline_reason'];
      
      for (const field of updatableFields) {
        if (fields[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(fields[field]);
          
          if (field === 'it_supervisor_approved_by' && fields[field]) {
            updates.push(`it_supervisor_approved_at = NOW()`);
          }
          if (field === 'manager_approved_by' && fields[field]) {
            updates.push(`manager_approved_at = NOW()`);
          }
        }
      }
      
      if (updates.length > 0) {
        values.push(id);
        const sql = `UPDATE overtime_requests SET ${updates.join(', ')} WHERE id=?`;
        await connection.execute(sql, values);
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /overtime PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update overtime request' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function DELETE(req: Request) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    
    connection = await mysql.createConnection(dbConfig);
    await connection.execute('DELETE FROM overtime_requests WHERE id = ?', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /overtime DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
