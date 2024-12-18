-- public.creators definition

-- Drop table

-- DROP TABLE public.creators;

CREATE TABLE public.creators (
	id int4 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL,
	"name" varchar NULL,
	website_url varchar NULL,
	CONSTRAINT creators_pk PRIMARY KEY (id)
);

-- public.dreams definition

-- Drop table

-- DROP TABLE public.dreams;

CREATE TABLE public.dreams (
	url_part varchar NOT NULL,
	creator_id int4 NULL,
	title varchar NULL,
	CONSTRAINT dreams_unique UNIQUE (url_part)
);


-- public.dreams foreign keys

ALTER TABLE public.dreams ADD CONSTRAINT dreams_creators_fk FOREIGN KEY (creator_id) REFERENCES public.creators(id);

-- public.users definition

-- Drop table

-- DROP TABLE public.users;

CREATE TABLE public.users (
	device_uid varchar(80) NULL,
	display_name varchar(80) NULL,
	currency int4 NULL,
	created_time timestamp DEFAULT CURRENT_TIMESTAMP NULL,
	CONSTRAINT users_unique UNIQUE (device_uid)
);

-- public.events definition

-- Drop table

-- DROP TABLE public.events;

CREATE TABLE public.events (
	id int4 GENERATED BY DEFAULT AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START 1 CACHE 1 NO CYCLE) NOT NULL,
	device_uid varchar NULL,
	"type" varchar NULL,
	impact_key varchar NULL,
	session_hash varchar NULL,
	dream_url_part varchar NULL,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	currency_value int4 NULL,
	CONSTRAINT events_pk PRIMARY KEY (id)
);


-- public.events foreign keys

ALTER TABLE public.events ADD CONSTRAINT events_dreams_fk FOREIGN KEY (dream_url_part) REFERENCES public.dreams(url_part);
ALTER TABLE public.events ADD CONSTRAINT events_users_fk FOREIGN KEY (device_uid) REFERENCES public.users(device_uid);