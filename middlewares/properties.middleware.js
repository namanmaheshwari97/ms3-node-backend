const utils = require('../core/utils');

function propertiesMiddleware(datastore, errorResponse, auth, CONFIG) {
    'use strict';

    const ENTITY_KEY = CONFIG.ENTITY_KEYS.PROPERTIES;
    const OPTIONS_ENTITY_KEY = CONFIG.ENTITY_KEYS.PROPERTY_OPTIONS;

    return {
        validateCreateForm,
        create,
        validateUpdateForm,
        update,
        getOptions,
        remove,
        getList,
        get,
        processPropertyDetail
    };

    function validateCreateForm(req, res, next) {
        const form = req.body;

        try {
            utils.throwIfFalse(validate(form.title, 'string', true), 'title field error');
            utils.throwIfFalse(validate(form.address, 'object', true), 'address field error');
            utils.throwIfFalse(validate(form.address.type, 'enum', true, {enumVal: ['APARTMENT', 'HOUSE']}), 'address field error');
            utils.throwIfFalse(validate(form.address.detailLevel1, 'string', true), 'address field error');
            utils.throwIfFalse(validate(form.address.detailLevel2, 'string', true), 'address field error');
            utils.throwIfFalse(validate(form.address.city, 'string', true), 'address field error');
            utils.throwIfFalse(validate(form.address.state, 'string', true), 'address field error');
            utils.throwIfFalse(validate(form.address.zipcode, 'string', true), 'address field error');
            utils.throwIfFalse(validate(form.address.geocode, 'object', true), 'address field error');
            utils.throwIfFalse(validate(form.address.geocode.lat, 'number', true), 'address field error');
            utils.throwIfFalse(validate(form.address.geocode.lng, 'number', true), 'address field error');
            utils.throwIfFalse(validate(form.roomType, 'enum', true, {enumVal: ['STUDIO', '1BR', '2BR', '3BR', '4BR']}), 'roomType field error');
            utils.throwIfFalse(validate(form.description, 'string', false), 'description field error');
            utils.throwIfFalse(validate(form.startDate, 'datetime', true), 'startDate field error');
            utils.throwIfFalse(validate(form.duration, 'number', true), 'duration field error');
            utils.throwIfFalse(validate(form.options, 'array', true), 'options field error');

            next();
        } catch (error) {
            errorResponse.send(res, 400, 'Form Invalid', error);
        }

    }

    function validate(input, type, required, options) {
        let typecheck = false;
        switch (type) {
            case 'string': {
                typecheck = typeof input === 'string';
                if (required) {
                    return typecheck;
                }
                break;
            }
            case 'enum': {
                typecheck = options.enumVal.includes(input);
                if (required) {
                    return typecheck;
                }
                break;
            }
            case 'number': {
                typecheck = !isNaN(parseFloat(input)) && isFinite(input);
                if (required) {
                    return typecheck;
                }
                break;
            }
            case 'object': {
                typecheck = typeof input === 'object' && !Array.isArray(input);
                if (required) {
                    return typecheck;
                }
                break;
            }
            case 'array': {
                typecheck = Array.isArray(input);
                if (required) {
                    return typecheck;
                }
                break;
            }
            case 'datetime': {
                typecheck = typeof input === 'string' && !isNaN(Date.parse(input));
                if (required) {
                    return typecheck;
                }
            }
        }
        return typecheck || typeof input === 'undefined';
    }

    function validateAccess(req, res, next) {
        var date = new Date();
        if (res.locals.tokenUser.access.vendor_next_payment_date < date) {
            errorResponse.send(res, 403, 'Vendor Access Requried');
        } else {
            if (res.locals.tokenUser.properties.length === 0 || 
                res.locals.tokenUser.access.vendor_additional_paid === true) {
                next();
            } else {
                errorResponse.send(res, 403, 'Vendor Additional Fee Requried');
            }
        }
    }

    function create(req, res, next) {
        const timestamp = new Date().toJSON();
        const form = req.body;
        form.status = false;
        form.owner = res.locals.decoded.data.id;
        form.imageUrls = [];
        form.createTime = timestamp;
        form.updateTime = timestamp;

        const key = datastore.key([ENTITY_KEY]);
        const userKey = datastore.key([CONFIG.ENTITY_KEYS.USERS, parseInt(res.locals.decoded.data.id)]);

        const property = {
            key: key,
            data: {
                status: false,
                title: form.title,
                address: form.address,
                roomType: form.roomType,
                description: form.description || '',
                startDate: form.startDate,
                duration: form.duration,
                price: form.price,
                options: form.options,
                imageUrls: [],
                owner: res.locals.decoded.data.id,
                createTime: timestamp,
                updateTime: timestamp
            }
        };

        datastore.save(property)
            .then(() => {
                return datastore.get(userKey);
            })
            .then((results) => {
                const user = results[0];

                if (!user.properties) {
                    user.properties = [key.id];
                } else {
                    user.properties = [...user.properties, key.id];
                    user.access.vendor_additional_paid = false;
                }

                return datastore.save({
                    key: userKey,
                    data: user
                });
            })
            .then(() => {
                res.status(201).json({
                    message: 'Created'
                });
                return new Promise((resolve, reject) => resolve());
            })
            .catch((error) => {
                errorResponse.send(res, 500, 'Internal Server Error', error);
            });
    }

    function validateUpdateForm(req, res, next) {
        const form = req.body;

        try {
            utils.throwIfFalse(validate(form.roomType, 'enum', true, {enumVal: ['STUDIO', '1BR', '2BR', '3BR', '4BR']}), 'roomType field error');
            utils.throwIfFalse(validate(form.description, 'string', false), 'description field error');
            utils.throwIfFalse(validate(form.startDate, 'datetime', true), 'startDate field error');
            utils.throwIfFalse(validate(form.duration, 'number', true), 'duration field error');
            utils.throwIfFalse(validate(form.options, 'array', true), 'options field error');

            next();
        } catch (error) {
            errorResponse.send(res, 400, 'Form Invalid', error);
        }
    }

    function update(req, res, next) {
        const timestamp = new Date().toJSON();
        const form = req.body;

        const key = datastore.key([ENTITY_KEY, parseInt(req.params.id)]);

        datastore.get(key)
            .then((results) => {
                const property = results[0];

                if (property) {
                    property.roomType = form.roomType;
                    property.description = form.description;
                    property.startDate = form.startDate;
                    property.duration = form.duration;
                    property.options = form.options;
                    property.updateTime = timestamp;

                    return datastore.save({
                        key: property[datastore.KEY],
                        data: property
                    });
                } else {
                    errorResponse.send(res, 404, 'Property Not Found');
                }
            })
            .then(() => res.status(200).json({
                message: 'Updated'
            }))
            .catch((error) => {
                errorResponse.send(res, 500, 'Internal Server Error', error);
            });
    }

    function getOptions(req, res) {
        const query = datastore.createQuery(OPTIONS_ENTITY_KEY);

        datastore.runQuery(query)
            .then((response) => {
                const entities = response[0].map((entity) => {
                    return {
                        id: entity[datastore.KEY].id,
                        type: entity.type,
                        alias: entity.alias
                    };
                });

                res.status(200).json(entities);
            })
            .catch((error) => {

                errorResponse.send(res, 500, 'Internal Server Error', error);
            });
    }

    function remove(req, res) {
        const key = datastore.key([ENTITY_KEY, parseInt(req.params.id)]);

        const transaction = datastore.transaction();

        transaction.run()
            .then(() => datastore.get(key))
            .then((response) => {
                const entity = response[0];
                if (entity) {
                    if (isUser(res) && !isOwner(res, entity)) {
                        errorResponse.send(res, 403, 'Not Owner');
                        transaction.rollback();
                    } else {
                        const userKey = datastore.key([
                            CONFIG.ENTITY_KEYS.USERS, parseInt(entity.owner)]);

                        return datastore.get(userKey);
                    }
                } else {
                    errorResponse.send(res, 404, 'Property Not Found');
                    transaction.rollback();
                }
            })
            .then((response) => {
                const entity = response[0];
                if (entity) {
                    entity.properties = entity.properties.filter((property) => {
                        return parseInt(property) !== parseInt(key.id);
                    });
                    transaction.delete(key);
                    transaction.save({
                        key: entity[datastore.KEY],
                        data: entity
                    });
                    return transaction.commit();
                } else {
                    errorResponse.send(res, 404, 'User Not Found');
                    transaction.rollback();
                }
            })
            .then(() => {
                res.status(200).json({
                    id: key.id
                });
            })
            .catch((error) => {
                errorResponse.send(res, 500, 'Internal Server Error', error);
                transaction.rollback();
            });
    }

    function isUser(res) {
        return res.locals.decoded.data.role === CONFIG.ROLES.USER;
    }

    function isOwner(res, entity) {
        return parseInt(res.locals.decoded.id) === parseInt(entity.owner);
    }

    function getList(req, res) {
        let query = generateQuery(req);
        if (query) {
            datastore.runQuery(query)
                .then((response) => {
                    const entities = response[0];
                    const meta = response[1];

                    res.status(200).json({
                        list: entities.map(generatePropertySummary),
                        cursor: meta.endCursor
                    });
                })
                .catch((error) => {
                    errorResponse.send(res, 500, 'Internal Server Error', error);
                });
        } else {
            errorResponse.send(res, 400, 'Required QueryParams Missing');
        }
    }

    function generateQuery(req) {
        let query = datastore.createQuery(ENTITY_KEY);
        const sortByMap = {
            price: 'price',
            recent: 'updateTime'
        };
        // /properties?sortBy={sortBy}&direction={direction}&cursor?={cursorToken}
        if (req.query.sortBy && req.query.direction) {
            if (req.query.direction === 'UP') {
                query = query.order(sortByMap[req.query.sortBy])
            } else {
                query = query.order(sortByMap[req.query.sortBy], {
                    descending: true
                });
            }

            if (req.query.cursor) {
                query = query.limit(5).start(req.query.cursor);
            } else {
                query = query.limit(10);
            }

            return query;
        } else {
            return null;
        }
    }

    function generatePropertySummary(entity) {

        return {
            id: entity[datastore.KEY].id,
            title: entity.title,
            address: getAddressString(entity.address),
            startDate: entity.startDate,
            duration: entity.duration,
            price: entity.price
        };
    }

    function getAddressString(address) {

        return `${address.detailLevel2}, ${address.city}, ${address.state}`;
    }

    function get(req, res, next) {
        const key = datastore.key([ENTITY_KEY, parseInt(req.params.id)]);

        datastore.get(key)
            .then((result) => {
                const entity = result[0];
                if (entity) {
                    res.locals.property = entity;
                    next();
                } else {

                    errorResponse.send(res, 404, 'Property Not Found');
                }
            })
            .catch((error) => {
                errorResponse.send(res, 500, 'Internal Server Error', error);
            });

    }

    function processPropertyDetail(req, res) {
        const token = req.get('token');
        if (token) {
            auth.checkAuth(req, res,
                auth.checkInactiveToken.bind(undefined, req, res,
                    returnProperty.bind(undefined, req, res)));
        } else {
            const entity = res.locals.property;
            res.status(200).json(
                Object.assign({}, {id: entity[datastore.KEY].id}, hideDetails(entity))
            );
        }
    }

    function returnProperty(req, res) {
        const user = res.locals.decoded.data;
        const role = res.locals.decoded.data.role;
        const entity = res.locals.property;
        if (role === CONFIG.ROLES.USER) {
            const key = datastore.key([CONFIG.ENTITY_KEYS.USERS, user.id]);
            datastore.get(key)
                .then((result) => {
                    const userEntity = result[0];
                    if (userEntity) {
                        if (userEntity.access && userEntity.access.customer_payment_amount) {
                            res.status(200).json(
                                Object.assign({}, {id: entity[datastore.KEY].id}, entity)
                            );
                        } else {
                            const entity = res.locals.property;
                            res.status(200).json(
                                Object.assign({}, {id: entity[datastore.KEY].id}, hideDetails(entity))
                            );
                        }
                    } else {
                        errorResponse.send(res, 500, 'Internal Server Error');
                    }
                })
        } else {
            res.status(200).json(
                Object.assign({}, {id: entity[datastore.KEY].id}, entity)
            );
        }
    }

    function hideDetails(entity) {
        let processed = Object.assign({}, entity);
        processed.owner = '';
        processed.address.detailLevel1 = '';
        processed.address.geocode.lat = Math.round(entity.address.geocode.lat * 100) / 100;
        processed.address.geocode.lng = Math.round(entity.address.geocode.lng * 100) / 100;

        return processed;
    }
}

module.exports = propertiesMiddleware;

/**
 *  PropertyOptions Entity
 *
 *  __key__=id:numeric
 *  {
 *      type: AMENITIES | HOUSE_RULES | PETS,
 *      alias: string
 *  }
 *
 *  Properties Entity
 *
 *  __key__=id:numeric
 *  {
 *      *status: boolean,
 *      *title: string,
 *      *address: {
 *          type: APARTMENT | HOUSE,
 *          detailLevel1: string,
 *          detailLevel2: string,
 *          city: string,
 *          state: string,
 *          zipcode: number,
 *          geocode: {
 *              lat: number,
 *              lng: number
 *          }
 *      },
 *      *roomType: STUDIO | 1BR | 2BR | 3BR | 4BR,
 *      description: string,
 *      *startDate: datetime,
 *      *duration: number,
 *      *price: number,
 *      options: PropertyOptions.__key__[],
 *      imageUrls: string[],
 *      *owner: User.__key__,
 *      *createdAt: datetime,
 *      *updatedAt: datetime
 *  }
 *
 *  PropertySummary
 *
 *  {
 *      title: string,
 *      address: string (_.detailLevel2 + _.city + _.state + _.zipcode,
 *      startDate: datetime,
 *      duration: number,
 *      price: number,
 *      imageUrls: string
 *  }
 *
 **/