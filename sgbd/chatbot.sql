drop database if exists chatbot;
create database chatbot;
use chatbot;

create table conversations (
    id int primary key auto_increment,
    title varchar(255) default 'Nova Conversa',
    created_at timestamp default current_timestamp
);

create table messages (
    id int primary key auto_increment,
    conversation_id int,
    text text,
    image_data longtext, 
    sender varchar(255),
    created_at timestamp default current_timestamp,
    foreign key (conversation_id) references conversations(id)
);

create table feedback_corrections (
    id int primary key auto_increment,
    conversation_id int,
    message_id int, 
    feedback_type varchar(50), 
    feedback_text varchar(255), 
    correction_text longtext, 
    user_id int null,
    created_at timestamp default current_timestamp,
    foreign key (conversation_id) references conversations(id),
    foreign key (message_id) references messages(id)
);