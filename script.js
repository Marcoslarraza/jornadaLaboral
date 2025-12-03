class RegistroTurnos {
    constructor() {
        // Configuración de Supabase
        this.supabaseUrl = 'https://hqautqedjrbpcwaoroqq.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxYXV0cWVkanJicGN3YW9yb3FxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3Nzg2MTMsImV4cCI6MjA4MDM1NDYxM30.yBdy0Qkr5cAHkfESZ-p1051HPCu14T4XIil6AJgw0Gc';
        this.supabase = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
        
        // ID de usuario simple (en producción usarías autenticación real)
        this.userId = localStorage.getItem('userId') || 'user-demo-' + Date.now();
        localStorage.setItem('userId', this.userId);
        
        this.registros = [];
        this.jornadaActiva = null;
        this.mesActual = new Date();
        this.editandoId = null;
        
        this.inicializar();
    }

    async inicializar() {
        this.actualizarFechaYHora();
        this.configurarEventListeners();
        
        // Cargar datos guardados
        await this.cargarJornadaActiva();
        await this.cargarRegistros();
        
        this.actualizarEstadoJornada();
        this.actualizarRegistrosMensuales();
        
        // Actualizar hora cada segundo
        setInterval(() => this.actualizarFechaYHora(), 1000);
    }

    actualizarFechaYHora() {
        const ahora = new Date();
        
        // Actualizar fecha
        const fechaInput = document.getElementById('fecha');
        if (fechaInput) {
            const fechaString = ahora.toISOString().split('T')[0];
            fechaInput.value = fechaString;
        }
        
        // Actualizar horas
        const horaInicio = document.getElementById('hora-inicio');
        const horaFin = document.getElementById('hora-fin');
        const horaString = ahora.toTimeString().slice(0, 5);
        
        if (horaInicio && !this.jornadaActiva) {
            horaInicio.value = horaString;
        }
        if (horaFin && this.jornadaActiva) {
            horaFin.value = horaString;
        }
    }

    configurarEventListeners() {
        // Botones de jornada
        document.getElementById('btn-iniciar').addEventListener('click', () => this.iniciarJornada());
        document.getElementById('btn-finalizar').addEventListener('click', () => this.finalizarJornada());
        
        // Controles de mes
        document.getElementById('btn-mes-anterior').addEventListener('click', () => this.cambiarMes(-1));
        document.getElementById('btn-mes-siguiente').addEventListener('click', () => this.cambiarMes(1));
        
        // Exportar PDF
        document.getElementById('btn-exportar-pdf').addEventListener('click', () => this.exportarPDF());
        
        // Modal
        document.getElementById('form-editar').addEventListener('submit', (e) => this.guardarEdicion(e));
        document.getElementById('btn-cancelar-editar').addEventListener('click', () => this.cerrarModal());
        document.querySelector('.close').addEventListener('click', () => this.cerrarModal());
        
        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-editar')) {
                this.cerrarModal();
            }
        });
    }

    async iniciarJornada() {
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora = ahora.toTimeString().slice(0, 5);
        
        this.jornadaActiva = {
            fecha: fecha,
            horaInicio: hora,
            timestamp: ahora.getTime()
        };
        
        await this.guardarJornadaActiva();
        this.actualizarEstadoJornada();
        
        // Mostrar notificación
        this.mostrarNotificacion('Jornada iniciada correctamente', 'success');
    }

    async finalizarJornada() {
        if (!this.jornadaActiva) return;
        
        const ahora = new Date();
        const horaFin = ahora.toTimeString().slice(0, 5);
        
        // Calcular horas trabajadas
        const horasTrabajadas = this.calcularHorasTrabajadas(
            this.jornadaActiva.horaInicio,
            horaFin
        );
        
        // Crear registro
        const registro = {
            id: Date.now().toString(),
            fecha: this.jornadaActiva.fecha,
            horaInicio: this.jornadaActiva.horaInicio,
            horaFin: horaFin,
            horasTrabajadas: horasTrabajadas,
            timestamp: ahora.getTime()
        };
        
        try {
            // Guardar en Supabase
            const registroGuardado = await this.guardarRegistro(registro);
            // Transformar datos al formato del frontend
            const registroParaFrontend = {
                id: registroGuardado.id,
                fecha: registroGuardado.fecha,
                horaInicio: registro.horaInicio,
                horaFin: registro.horaFin,
                horasTrabajadas: registro.horasTrabajadas,
                timestamp: registro.timestamp
            };
            this.registros.unshift(registroParaFrontend);
            
            // Limpiar jornada activa
            this.jornadaActiva = null;
            await this.guardarJornadaActiva();
            
            // Actualizar interfaz
            this.actualizarEstadoJornada();
            this.actualizarRegistrosMensuales();
            
            // Mostrar notificación
            this.mostrarNotificacion('Jornada finalizada correctamente', 'success');
        } catch (error) {
            console.error('Error finalizando jornada:', error);
            this.mostrarNotificacion('Error finalizando jornada', 'error');
        }
    }

    calcularHorasTrabajadas(horaInicio, horaFin) {
        const [inicioHoras, inicioMinutos] = horaInicio.split(':').map(Number);
        const [finHoras, finMinutos] = horaFin.split(':').map(Number);
        
        const inicioTotalMinutos = inicioHoras * 60 + inicioMinutos;
        const finTotalMinutos = finHoras * 60 + finMinutos;
        
        let diferenciaMinutos = finTotalMinutos - inicioTotalMinutos;
        
        // Si la jornada pasa medianoche
        if (diferenciaMinutos < 0) {
            diferenciaMinutos += 24 * 60;
        }
        
        const horas = Math.floor(diferenciaMinutos / 60);
        const minutos = diferenciaMinutos % 60;
        
        return `${horas}h ${minutos}m`;
    }

    actualizarEstadoJornada() {
        const estadoDiv = document.getElementById('estado-jornada');
        const btnIniciar = document.getElementById('btn-iniciar');
        const btnFinalizar = document.getElementById('btn-finalizar');
        
        if (this.jornadaActiva) {
            estadoDiv.innerHTML = `
                <p class="estado-activo">
                    <strong>Jornada activa</strong><br>
                    Iniciada: ${this.jornadaActiva.fecha} ${this.jornadaActiva.horaInicio}
                </p>
            `;
            btnIniciar.disabled = true;
            btnFinalizar.disabled = false;
        } else {
            estadoDiv.innerHTML = '<p class="estado-inactivo">No hay jornada activa</p>';
            btnIniciar.disabled = false;
            btnFinalizar.disabled = true;
        }
    }

    cambiarMes(direccion) {
        this.mesActual.setMonth(this.mesActual.getMonth() + direccion);
        this.actualizarRegistrosMensuales();
    }

    actualizarRegistrosMensuales() {
        // Actualizar título del mes
        const mesSpan = document.getElementById('mes-actual');
        const opciones = { year: 'numeric', month: 'long' };
        mesSpan.textContent = this.mesActual.toLocaleDateString('es-ES', opciones);
        
        // Filtrar registros del mes actual
        const registrosMes = this.obtenerRegistrosMes(this.mesActual);
        
        // Actualizar tabla
        this.actualizarTabla(registrosMes);
        
        // Actualizar total de horas
        this.actualizarTotalHoras(registrosMes);
    }

    obtenerRegistrosMes(fecha) {
        const año = fecha.getFullYear();
        const mes = fecha.getMonth();
        
        return this.registros.filter(registro => {
            const registroFecha = new Date(registro.fecha);
            return registroFecha.getFullYear() === año && registroFecha.getMonth() === mes;
        }).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }

    actualizarTabla(registros) {
        const tbody = document.getElementById('cuerpo-tabla');
        const tabla = document.getElementById('tabla-registros');
        const sinRegistros = document.getElementById('sin-registros');
        
        tbody.innerHTML = '';
        
        if (registros.length === 0) {
            tabla.style.display = 'none';
            sinRegistros.style.display = 'block';
            return;
        }
        
        tabla.style.display = 'table';
        sinRegistros.style.display = 'none';
        
        registros.forEach(registro => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${this.formatearFecha(registro.fecha)}</td>
                <td>${registro.horaInicio}</td>
                <td>${registro.horaFin}</td>
                <td><strong>${registro.horasTrabajadas}</strong></td>
                <td>
                    <button class="btn btn-editar" onclick="app.editarRegistro('${registro.id}')">Editar</button>
                    <button class="btn btn-eliminar" onclick="app.confirmarEliminarRegistro('${registro.id}')">Eliminar</button>
                </td>
            `;
            tbody.appendChild(fila);
        });
    }

    actualizarTotalHoras(registros) {
        const totalMinutos = registros.reduce((total, registro) => {
            if (!registro.horasTrabajadas) return total;
            const match = registro.horasTrabajadas.match(/(\d+)h (\d+)m/);
            if (match) {
                const horas = parseInt(match[1]);
                const minutos = parseInt(match[2]);
                return total + (horas * 60 + minutos);
            }
            return total;
        }, 0);
        
        const horas = Math.floor(totalMinutos / 60);
        const minutos = totalMinutos % 60;
        
        document.getElementById('total-horas-mes').textContent = `${horas}h ${minutos}m`;
    }

    formatearFecha(fechaString) {
        const fecha = new Date(fechaString);
        const opciones = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return fecha.toLocaleDateString('es-ES', opciones);
    }

    editarRegistro(id) {
        const registro = this.registros.find(r => r.id === id);
        if (!registro) return;
        
        this.editandoId = id;
        
        // Llenar formulario
        document.getElementById('editar-fecha').value = registro.fecha;
        document.getElementById('editar-hora-inicio').value = registro.horaInicio;
        document.getElementById('editar-hora-fin').value = registro.horaFin;
        
        // Mostrar modal
        document.getElementById('modal-editar').style.display = 'block';
    }

    guardarEdicion(e) {
        e.preventDefault();
        
        const registro = this.registros.find(r => r.id === this.editandoId);
        if (!registro) return;
        
        // Actualizar datos
        registro.fecha = document.getElementById('editar-fecha').value;
        registro.horaInicio = document.getElementById('editar-hora-inicio').value;
        registro.horaFin = document.getElementById('editar-hora-fin').value;
        registro.horasTrabajadas = this.calcularHorasTrabajadas(
            registro.horaInicio,
            registro.horaFin
        );
        
        // Guardar cambios
        this.guardarRegistros();
        this.actualizarRegistrosMensuales();
        this.cerrarModal();
        
        this.mostrarNotificacion('Registro actualizado correctamente', 'success');
    }

    async eliminarRegistroFromSupabase(id) {
        if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;
        
        try {
            // Eliminar en Supabase
            // await this.eliminarRegistroFromSupabase(id);
            
            // Eliminar en memoria
            this.registros = this.registros.filter(r => r.id !== id);
            
            this.actualizarRegistrosMensuales();
            
            this.mostrarNotificacion('Registro eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error eliminando registro:', error);
            this.mostrarNotificacion('Error eliminando registro', 'error');
        }
    }

    cerrarModal() {
        document.getElementById('modal-editar').style.display = 'none';
        this.editandoId = null;
    }

    exportarPDF() {
        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            console.error('jsPDF no está cargado');
            this.mostrarNotificación('Error: librería PDF no disponible', 'error');
            return;
        }
        const doc = new jsPDF();
        
        // Configuración
        doc.setFont('helvetica');
        doc.setFontSize(20);
        doc.text('Registro de Turnos de Trabajo', 105, 20, { align: 'center' });
        
        doc.setFontSize(14);
        const mesTexto = this.mesActual.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
        doc.text(`Mes: ${mesTexto}`, 105, 30, { align: 'center' });
        
        // Obtener datos
        const registros = this.obtenerRegistrosMes(this.mesActual);
        
        if (registros.length === 0) {
            doc.setFontSize(12);
            doc.text('No hay registros para este mes', 105, 50, { align: 'center' });
        } else {
            // Preparar datos para la tabla
            const datosTabla = registros.map(registro => [
                this.formatearFecha(registro.fecha),
                registro.horaInicio,
                registro.horaFin,
                registro.horasTrabajadas
            ]);
            
            // Crear tabla
            doc.autoTable({
                head: [['Fecha', 'Hora Inicio', 'Hora Fin', 'Horas Trabajadas']],
                body: datosTabla,
                startY: 40,
                theme: 'grid',
                styles: { fontSize: 10 },
                headStyles: { fillColor: [66, 153, 225], textColor: 255 }
            });
            
            // Total de horas
            const totalMinutos = registros.reduce((total, registro) => {
                if (!registro.horasTrabajadas) return total;
                const match = registro.horasTrabajadas.match(/(\d+)h (\d+)m/);
                if (match) {
                    const horas = parseInt(match[1]);
                    const minutos = parseInt(match[2]);
                    return total + (horas * 60 + minutos);
                }
                return total;
            }, 0);
            
            const horas = Math.floor(totalMinutos / 60);
            const minutos = totalMinutos % 60;
            
            const finalY = doc.lastAutoTable.finalY || 40;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total horas trabajadas: ${horas}h ${minutos}m`, 105, finalY + 10, { align: 'center' });
        }
        
        // Descargar PDF
        const nombreArchivo = `registros-turnos-${mesTexto.replace(/\s+/g, '-').toLowerCase()}.pdf`;
        doc.save(nombreArchivo);
        
        this.mostrarNotificacion('PDF exportado correctamente', 'success');
    }

    async guardarJornadaActiva() {
        try {
            if (this.jornadaActiva) {
                // Guardar jornada activa en localStorage para persistencia
                localStorage.setItem('jornadaActiva', JSON.stringify(this.jornadaActiva));
            } else {
                // Limpiar jornada activa
                localStorage.removeItem('jornadaActiva');
            }
        } catch (error) {
            console.error('Error guardando jornada activa:', error);
        }
    }

    async cargarJornadaActiva() {
        try {
            const guardada = localStorage.getItem('jornadaActiva');
            if (guardada) {
                this.jornadaActiva = JSON.parse(guardada);
            }
        } catch (error) {
            console.error('Error cargando jornada activa:', error);
        }
    }

    async guardarRegistro(registro) {
        try {
            // Guardar en Supabase
            const { data, error } = await this.supabase
                .from('registros_turnos')
                .insert([{
                    id: registro.id,
                    user_id: this.userId,
                    fecha: registro.fecha,
                    hora_inicio: registro.horaInicio,
                    hora_fin: registro.horaFin,
                    horas_trabajadas: registro.horasTrabajadas
                }])
                .select();
            
            if (error) throw error;
            return data[0];
        } catch (error) {
            console.error('Error guardando registro:', error);
            // Fallback: guardar en localStorage
            this.registros.unshift(registro);
            this.guardarRegistrosLocal();
            return registro;
        }
    }

    async cargarRegistros() {
        try {
            // Cargar desde Supabase
            const { data, error } = await this.supabase
                .from('registros_turnos')
                .select('*')
                .eq('user_id', this.userId)
                .order('fecha', { ascending: false });
            
            if (error) throw error;
            
            console.log('Datos de Supabase:', data);
            console.log('Primer registro:', data[0]);
            console.log('Keys del primer registro:', Object.keys(data[0] || {}));
            
            // Transformar datos al formato esperado
            this.registros = data.map(registro => ({
                id: registro.id,
                fecha: registro.fecha,
                horaInicio: registro.hora_inicio,
                horaFin: registro.hora_fin,
                horasTrabajadas: registro.horas_trabajadas,
                timestamp: registro.timestamp
            }));
        } catch (error) {
            console.error('Error cargando registros:', error);
            // Fallback: cargar desde localStorage
            this.cargarRegistrosLocal();
        }
    }

    guardarRegistrosLocal() {
        try {
            localStorage.setItem('registros', JSON.stringify(this.registros));
        } catch (error) {
            console.error('Error guardando registros localmente:', error);
        }
    }

    cargarRegistrosLocal() {
        try {
            const guardados = localStorage.getItem('registros');
            console.log('Datos en localStorage:', guardados);
            if (guardados) {
                this.registros = JSON.parse(guardados);
                console.log('Registros parseados:', this.registros);
            }
        } catch (error) {
            console.error('Error cargando registros localmente:', error);
        }
    }

    async guardarRegistros() {
        try {
            // Actualizar en Supabase
            for (const registro of this.registros) {
                await this.supabase
                    .from('registros_turnos')
                    .update({
                        fecha: registro.fecha,
                        hora_inicio: registro.horaInicio,
                        hora_fin: registro.horaFin,
                        horas_trabajadas: registro.horasTrabajadas
                    })
                    .eq('id', registro.id);
            }
        } catch (error) {
            console.error('Error guardando registros:', error);
            // Fallback: guardar localmente
            this.guardarRegistrosLocal();
        }
    }

    async eliminarRegistro(id) {
        try {
            // Eliminar de Supabase
            const { error } = await this.supabase
                .from('registros_turnos')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            // Eliminar de memoria
            this.registros = this.registros.filter(r => r.id !== id);
            this.actualizarRegistrosMensuales();
            
            this.mostrarNotificacion('Registro eliminado correctamente', 'success');
        } catch (error) {
            console.error('Error eliminando registro:', error);
            this.mostrarNotificacion('Error eliminando registro', 'error');
        }
    }

    mostrarNotificacion(mensaje, tipo) {
        // Crear elemento de notificación
        const notificacion = document.createElement('div');
        notificacion.className = `notificacion notificacion-${tipo}`;
        notificacion.textContent = mensaje;
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${tipo === 'success' ? '#48bb78' : '#f56565'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 10000;
            font-weight: 600;
            animation: slideInRight 0.3s ease;
        `;
        
        // Añadir animación
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notificacion);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            notificacion.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => {
                if (notificacion.parentNode) {
                    notificacion.parentNode.removeChild(notificacion);
                }
            }, 300);
        }, 3000);
    }

}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RegistroTurnos();
});