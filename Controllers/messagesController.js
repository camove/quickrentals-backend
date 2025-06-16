const Message = require("../Models/messageModel");
const Flat = require("../Models/flatModel");

//* Utilizatorul vede toate mesajele pentru apartamentul sau *//
exports.getAllMessages = async (req, res) => {
    try {
        const { id: flatId } = req.params;
        const currentUser = req.currentUser;

        //-> Verifica daca apartamentul exista
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({
                status: 'failed',
                message: 'Flat not found'
            });
        }

        //-> Verifica daca user-ul este owner-ul apartamentului
        if (flat.ownerId.toString() !== currentUser.id) {
            return res.status(403).json({
                status: 'failed',
                message: 'You can only view messages for your own flats'
            });
        }

        //-> Aduce toate mesajele pentru acest apartament
        const messages = await Message.find({ flatId })
            .populate('userId', 'firstName lastName email')
            .sort({ createdAt: -1 }); // mesajele noi sunt primele

        res.status(200).json({
            status: 'success',
            results: messages.length,
            data: messages
        });

    } catch (error) {
        res.status(500).json({
            status: 'failed',
            message: 'Error fetching messages',
            error: error.message
        });
    }
};

//* Utilizatorul vede doar mesajele lui (pe care le-a trimis pe un anumit apartament)
exports.getUserMessages = async (req, res) => {
    try {
        const { id: flatId, senderId } = req.params;
        const currentUser = req.currentUser;

        //-> Verifica daca user-ul poate vedea aceste mesaje (doar ale sale)
        if (senderId !== currentUser.id) {
            return res.status(403).json({
                status: 'failed',
                message: 'You can only view your own messages'
            });
        }

        //-> Verifica daca apartamentul exista
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({
                status: 'failed',
                message: 'Flat not found'
            });
        }

        //-> Aduce mesajele user-ului pentru acest apartament
        const messages = await Message.find({ 
            flatId, 
            userId: senderId 
        })
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 });

        res.status(200).json({
            status: 'success',
            results: messages.length,
            data: messages
        });

    } catch (error) {
        res.status(500).json({
            status: 'failed',
            message: 'Error fetching your messages',
            error: error.message
        });
    }
};

//* Trimitere mesaj nou *//
exports.addMessage = async (req, res) => {
    try {
        const { id: flatId } = req.params;
        const { content } = req.body;
        const currentUser = req.currentUser;

        //-> Verifica daca apartamentul exista
        const flat = await Flat.findById(flatId);
        if (!flat) {
            return res.status(404).json({
                status: 'failed',
                message: 'Flat not found'
            });
        }

        //-> Verifica ca user-ul sa NU fie owner-ul apartamentului
        if (flat.ownerId.toString() === currentUser.id) {
            return res.status(400).json({
                status: 'failed',
                message: 'You cannot send messages to your own flat'
            });
        }

        //-> Validare continut mesaj
        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                status: 'failed',
                message: 'Message content is required'
            });
        }

        if (content.length > 200) {
            return res.status(400).json({
                status: 'failed',
                message: 'Message too long (max 200 characters)'
            });
        }

        //-> Creeaza mesajul
        const newMessage = await Message.create({
            content: content.trim(),
            flatId,
            userId: currentUser.id
        });

        //-> Populate user info pentru vizualizare mesaj
        await newMessage.populate('userId', 'firstName lastName email');

        res.status(201).json({
            status: 'success',
            data: newMessage
        });

    } catch (error) {
        res.status(500).json({
            status: 'failed',
            message: 'Error creating message',
            error: error.message
        });
    }
};