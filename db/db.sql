show databases;

Drop database if exists governmint;

CREATE DATABASE IF NOT EXISTS governmint;

USE governmint;

drop user if exists  'governmint_server';

CREATE USER IF NOT EXISTS 'governmint_server' IDENTIFIED BY '00112233';
GRANT ALL PRIVILEGES ON governmint.* TO 'governmint_server';

create table voter (
    ssn INT,
    fname VARCHAR(50),
    lname VARCHAR(50),
    n VARCHAR(700),
    e VARCHAR(700),
    can_vote_on JSON,
    PRIMARY KEY (ssn)
);

CREATE TABLE vote (
    guid VARCHAR(116),
    issue_id VARCHAR(50),
    choice VARCHAR(50),
    ris JSON,
    PRIMARY KEY (guid)
);

CREATE TABLE issue (
    id VARCHAR(20),
    code_name VARCHAR(50),
    description VARCHAR(700),
    options JSON,
    deadline DATE,
    PRIMARY KEY (code_name)
);

CREATE TABLE vm (
    id VARCHAR(50),
    url VARCHAR(2000),
    n VARCHAR(700),
    e VARCHAR(700),
    PRIMARY KEY (id)
);

INSERT INTO issue VALUES (UUID_SHORT(), 'prop_44', '','["Yes","No"]', '2020-12-12');
INSERT INTO issue VALUES (UUID_SHORT(), 'COMDOM', '','["Yes","No"]', '2020-12-12');
INSERT INTO voter VALUES ('123456789', 'fname1', 'lname2','', '', '["COMDOM"]');
