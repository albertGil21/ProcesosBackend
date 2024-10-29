import { Router } from "express";
import {PrismaClient} from '@prisma/client';

const router=Router();
const prisma =new PrismaClient();


router.get('/obtener_asistencia', async (req, res) => {
    const { date } = req.body;
 
    // Convertimos la fecha recibida a un objeto Date compatible con Prisma
    const fecha = new Date(`${date}T00:00:00Z`); // Asegura que esté en UTC al inicio del día
 
    try {
        const usuarios = await prisma.usuario.findMany({
            select: {
                id_usuario: true,
                nombre: true,
                apellido: true,
                email: true,
                matriculas: {
                    select: {
                        id_matricula: true,
                        asistencias: {
                            where: {
                                fecha: fecha // Utilizamos la fecha como un objeto Date
                            },
                            select: {
                                hora_entrada: true,
                                hora_salida: true
                            }
                        }
                    }
                }
            }
        });
 
        const usuariosConAsistencia = usuarios.map(usuario => {
            const asistencia = usuario.matriculas[0]?.asistencias[0];
            return {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                email: usuario.email,
                hora_entrada: asistencia?.hora_entrada ? asistencia.hora_entrada.toISOString().split('T')[1].split('.')[0] : null,
                hora_salida: asistencia?.hora_salida ? asistencia.hora_salida.toISOString().split('T')[1].split('.')[0] : null
            };
        });
 
        res.json(usuariosConAsistencia); // Envía la respuesta JSON con los datos procesados
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.post('/marcar_asistencia', async (req, res) => {
    const { id_matricula, date, time } = req.body;

    try {
        // Convertimos id_matricula a un número entero
        const matriculaId = parseInt(id_matricula, 10);
        const fecha = new Date(`${date}T00:00:00Z`); 

        if (isNaN(matriculaId)) {
            return res.status(400).json({ message: 'El id_matricula debe ser un número válido' });
        }

        // Crear un objeto Date para hora_entrada
        const [entradaHours, entradaMinutes] = time.split(':').map(Number);
        const horaEntrada = new Date(fecha);
        horaEntrada.setUTCHours(entradaHours, entradaMinutes); // Usar setUTCHours para mantener en UTC

        // Verificar si ya existe una asistencia para el id_matricula y fecha dada
        const asistenciaExistente = await prisma.asistencias.findFirst({
            where: {
                matriculas: {
                    id_matricula: matriculaId
                },
                fecha: fecha
            }
        });

        if (!asistenciaExistente) {
            // No existe una asistencia para esa fecha, así que creamos una nueva con hora_entrada
            const nuevaAsistencia = await prisma.asistencias.create({
                data: {
                    fecha: fecha,
                    hora_entrada: horaEntrada, // Usamos el objeto Date para hora_entrada
                    estado_asistencia: 'presente', // Ajusta el valor de estado_asistencia según tu lógica
                    matriculas: {
                        connect: { id_matricula: matriculaId }
                    }
                }
            });
            res.json({
                message: 'Asistencia registrada con hora de entrada',
                asistencia: {
                    ...nuevaAsistencia,
                    hora_entrada: nuevaAsistencia.hora_entrada.toISOString().split('T')[1].split('.')[0] // Formatear la hora de entrada
                }
            });
        } else if (!asistenciaExistente.hora_salida) {
            // Existe una asistencia con hora_entrada pero sin hora_salida, así que guardamos la salida
            const [salidaHours, salidaMinutes] = time.split(':').map(Number);
            const horaSalida = new Date(fecha);
            horaSalida.setUTCHours(salidaHours, salidaMinutes); // Usar setUTCHours para mantener en UTC

            const asistenciaActualizada = await prisma.asistencias.update({
                where: { id_asistencia: asistenciaExistente.id_asistencia },
                data: {
                    hora_salida: horaSalida, // Usamos el objeto Date para hora_salida
                    estado_asistencia: 'presente' // Ajusta el valor de estado_asistencia según tu lógica
                }
            });
            res.json({
                message: 'Asistencia registrada con hora de salida',
                asistencia: {
                    ...asistenciaActualizada,
                    hora_salida: asistenciaActualizada.hora_salida.toISOString().split('T')[1].split('.')[0] // Formatear la hora de salida
                }
            });
        } else {
            // Si ya hay hora_salida, es un caso inesperado (la asistencia está completa)
            res.status(400).json({ message: 'La asistencia para esta fecha ya está completa' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.get('/obtener_usuario', async (req, res) => {
    try {
        // Obtener todos los usuarios con sus respectivas matrículas y membresías
        const usuarios = await prisma.usuario.findMany({
            include: {
                matriculas: {
                    include: {
                        membresias: true // Incluye las membresías asociadas
                    }
                }
            }
        });

        const tipoMembresiaMap = {
            1: 'mensual',
            2: 'trimestral',
            3: 'semestral',
            4: 'anual'
        };

        const resultado = usuarios.map(usuario => {
            // Obtener el estado de matrícula
            const estado_membresia = usuario.matriculas.length > 0 ? usuario.matriculas[0].estado_matricula : null;
            
            // Obtener la membresía asociada a la primera matrícula
            const membresia = usuario.matriculas.length > 0 && usuario.matriculas[0].membresias
                ? usuario.matriculas[0].membresias // Esto devuelve las membresías asociadas
                : null;

            return {
                dni: usuario.dni,
                nombres: usuario.nombre,
                apellidos: usuario.apellido,
                estado_membresia: estado_membresia,
                inicio_membresia: membresia ? membresia.fecha_inicio.toISOString().split('T')[0] : null, // Formato YYYY-MM-DD
                fin_membresia: membresia ? membresia.fecha_vencimiento.toISOString().split('T')[0] : null, // Formato YYYY-MM-DD
                tipo_membresia: membresia ? tipoMembresiaMap[membresia.id_tipo_membresia] : null // Mapeo del tipo de membresía
            };
        });

        res.json(resultado);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.post('/crear_usuario', async (req, res) => {
    const {
        dni,
        apellido,
        nombre,
        email,
        telefono,
        direccion,
        fecha_registro,
        inicio_membresia,
        fin_membresia,
        tipo_membresia,
    } = req.body;

    // Mapear tipo de membresía a su id correspondiente
    const tipoMembresiaMap = {
        mensual: 1,
        trimestral: 2,
        semestral: 3,
        anual: 4,
    };

    const id_tipo_membresia = tipoMembresiaMap[tipo_membresia];

    if (!id_tipo_membresia) {
        return res.status(400).json({ message: 'Tipo de membresía no válido' });
    }

    try {
        // 1. Crear el usuario
        const nuevoUsuario = await prisma.usuario.create({
            data: {
                dni,
                apellido,
                nombre,
                email,
                telefono,
                direccion,
                fecha_registro: new Date(fecha_registro), // Convertir a Date
            },
        });

        // 2. Obtener el id_usuario generado
        const id_usuario = nuevoUsuario.id_usuario;

        // 3. Crear la membresía
        const nuevaMembresia = await prisma.membresias.create({
            data: {
                id_usuario:id_usuario,
                id_tipo_membresia:id_tipo_membresia,
                id_gimnasio: 1, // Usar id_gimnasio fijo 1
                fecha_inicio: new Date(inicio_membresia), // Convertir a Date
                fecha_vencimiento: new Date(fin_membresia), // Convertir a Date
            },
        });

        // 4. Obtener el id_membresia generado
        const id_membresia = nuevaMembresia.id_membresia;

        // 5. Crear la matrícula
        await prisma.matriculas.create({
            data: {
                id_usuario,
                id_membresia,
                id_gimnasio: 1, // Usar id_gimnasio fijo 1
                fecha_matricula: new Date(inicio_membresia), // Convertir a Date
                estado_matricula: 'activa',
            },
        });

        res.status(201).json({ message: 'Usuario creado exitosamente', id_usuario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


export default router;