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
                id_matricula: usuario.matriculas[0]?.id_matricula || null, // Añadido id_matricula
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

// Endpoint para agregar una actividad con horarios
router.post('/actividades', async (req, res) => {
    const { id_gimnasio, nombre_actividad, descripcion, horarios } = req.body;

    // Validar datos obligatorios
    if (!nombre_actividad) {
        return res.status(400).json({ error: 'El campo nombre_actividad es obligatorio.' });
    }

    if (!horarios || !Array.isArray(horarios) || horarios.length === 0) {
        return res.status(400).json({ error: 'Debes proporcionar al menos un horario.' });
    }

    try {
        // Depurar los datos recibidos
        console.log("Datos recibidos para los horarios:", horarios);

        // Convertir las fechas a objetos Date para garantizar el formato correcto
        const horariosCorrectos = horarios.map(h => ({
            ...h,
            fecha: new Date(h.fecha), // Asegura que la fecha es un objeto Date
            hora_inicio: new Date(h.hora_inicio), // Asegura que hora_inicio es un objeto Date
            hora_fin: new Date(h.hora_fin), // Asegura que hora_fin es un objeto Date
        }));

        console.log("Datos de horarios convertidos:", horariosCorrectos);

        // Crear la actividad con horarios asociados
        const nuevaActividad = await prisma.actividades.create({
            data: {
                id_gimnasio,
                nombre_actividad,
                descripcion,
                horarios: {
                    create: horariosCorrectos.map(h => ({
                        id_gimnasio,
                        fecha: h.fecha,
                        hora_inicio: h.hora_inicio,
                        hora_fin: h.hora_fin,
                        id_trabajador: h.id_trabajador || null, // Opcional
                    })),
                },
            },
            include: {
                horarios: true, // Incluye los horarios creados en la respuesta
            },
        });

        res.status(201).json({ message: 'Actividad y horarios creados exitosamente.', actividad: nuevaActividad });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ocurrió un error al crear la actividad y sus horarios.' });
    }
});

// Endpoint para agregar un trabajador
router.post('/trabajadores', async (req, res) => {
    try {
      const {
        id_gimnasio,
        nombres,
        apellidos,
        email,
        cargo,
        tipo_sueldo,
        sueldo
      } = req.body;
  
      // Validaciones básicas
      if (!nombres || !apellidos || !email || !cargo || !tipo_sueldo) {
        return res.status(400).json({ error: 'Todos los campos requeridos deben estar completos.' });
      }
  
      // Creación del trabajador
      const nuevoTrabajador = await prisma.trabajadores.create({
        data: {
          id_gimnasio: id_gimnasio || null, // Permite valores nulos para id_gimnasio
          nombres,
          apellidos,
          email,
          cargo,
          tipo_sueldo,
          sueldo: sueldo || null, // Permite valores nulos para sueldo
        },
      });
  
      res.status(201).json({
        message: 'Trabajador creado exitosamente.',
        trabajador: nuevoTrabajador,
      });
    } catch (error) {
      console.error('Error al agregar trabajador:', error);
      res.status(500).json({
        error: 'Ocurrió un error al agregar el trabajador.',
        details: error.message,
      });
    }
  });
// Endpoint para obtener todas las actividades
router.get('/actividades', async (req, res) => {
    try {
      // Obtener las actividades con los horarios y el profesor (trabajador)
      const actividades = await prisma.actividades.findMany({
        include: {
          horarios: {
            include: {
              trabajadores: {
                select: {
                  nombres: true,
                  apellidos: true
                }
              }
            }
          }
        }
      });
  
      // Formatear la respuesta para mostrar los campos solicitados
      const actividadesFormateadas = actividades.map(actividad => {
        return actividad.horarios.map(horario => {
          // Convertir las fechas y horas para mantener el formato correcto
          const hora_inicio = new Date(horario.hora_inicio);
          const hora_fin = new Date(horario.hora_fin);
          
          // Asegurar que las horas se muestren en el formato adecuado
          const horaInicioFormateada = `${hora_inicio.getUTCHours()}:${hora_inicio.getUTCMinutes().toString().padStart(2, '0')}`;
          const horaFinFormateada = `${hora_fin.getUTCHours()}:${hora_fin.getUTCMinutes().toString().padStart(2, '0')}`;
  
          return {
            id_actividad: actividad.id_actividad, // Incluir el id de la actividad
            fecha: horario.fecha,
            hora_inicio: horaInicioFormateada, // Formato correcto de hora
            hora_fin: horaFinFormateada, // Formato correcto de hora
            actividad: actividad.nombre_actividad,
            profesor: `${horario.trabajadores.nombres} ${horario.trabajadores.apellidos}`
          };
        });
      }).flat();
  
      // Devolver la respuesta con las actividades
      res.json({
        actividades: actividadesFormateadas
      });
    } catch (error) {
      console.error('Error al obtener las actividades:', error);
      res.status(500).json({
        message: 'Error al obtener las actividades'
      });
    }
});

// Endpoint para obtener la lista de trabajadores con los campos solicitados
router.get('/trabajadores', async (req, res) => {
    try {
      const trabajadores = await prisma.trabajadores.findMany({
        select: {
          nombres: true,
          apellidos: true,
          tipo_sueldo: true,
          cargo: true
        }
      });
      res.json(trabajadores);
    } catch (error) {
      res.status(500).json({ error: 'Hubo un error al obtener los trabajadores' });
    }
  });

 // Endpoint para eliminar una actividad
router.delete('/actividades', async (req, res) => {
    const { id_actividad } = req.body; // Obtén el id de la actividad desde el cuerpo de la solicitud
    
    // Verificar si el id fue proporcionado
    if (!id_actividad) {
      return res.status(400).json({ error: 'El campo id_actividad es obligatorio.' });
    }
  
    try {
      // Verificar si la actividad existe
      const actividadExistente = await prisma.actividades.findUnique({
        where: { id_actividad: parseInt(id_actividad) },
        include: { horarios: true }, // Incluir horarios asociados a la actividad
      });
  
      if (!actividadExistente) {
        return res.status(404).json({ error: 'Actividad no encontrada.' });
      }
  
      // Eliminar los horarios asociados a la actividad
      if (actividadExistente.horarios.length > 0) {
        await prisma.horarios.deleteMany({
          where: { id_actividad: parseInt(id_actividad) }
        });
      }
  
      // Eliminar la actividad
      await prisma.actividades.delete({
        where: { id_actividad: parseInt(id_actividad) }
      });
  
      // Devolver una respuesta exitosa
      res.status(200).json({ message: 'Actividad y horarios eliminados exitosamente.' });
    } catch (error) {
      console.error('Error al eliminar la actividad:', error);
      res.status(500).json({ error: 'Ocurrió un error al eliminar la actividad.' });
    }
  });
  


export default router;